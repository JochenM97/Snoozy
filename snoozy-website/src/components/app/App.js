import React, { Component } from 'react';
import BigClock from '../clock/BigClock';
import Alarm from '../clock/Alarm';
import { db } from '../../firebase/firebase';
import NotificationsOverview from '../notifications/NotificationsOverview';
import Buzz from '../../assets/audio/buzz.mp3';
import Sound from 'react-sound';
import Overlay from '../overlay/Overlay';
import axios from 'axios';

const google  			= window.google;
const GOOGLE_MAP_KEY 	= 'AIzaSyDe2RQwYRxTmKXBFkr6d9oQqNOrT9K95hg';


class App extends Component {
	constructor (props) {
		super(props);
		this.state = {
			autoCalculateIsOn: false,
			departureTime: null,
			totalTime: null,

			destination: '',
            start_date: '',
			start_time: '',
			
			alarmIsPlaying: false,
			timeAlarmOn: 0,

			overlayIsPressed: false,

			snoozyLocation: '',
		};

		this.counter 	= 0;
	}

	componentDidMount = () => {
		// Keep checking with a 1 minute interval
		this.interval = setInterval(() => { 
			this.getFirebaseData();
		}, 60000);

		this.tickInterval 	= setInterval(() => {
			// Check if alarm time is the same as the current time.
			this.CheckAlarm();

			// Check if alarm is ringing and shut down after 8 seconds.
			if (this.state.alarmIsPlaying)
			{
				this.setState({ timeAlarmOn: this.state.timeAlarmOn + 1 });
			}

			if (this.state.timeAlarmOn === 8)
			{
				this.setState({ alarmIsPlaying: false });
			}

			// Handling overlay timer 
			if (this.state.overlayIsPressed)
			{
				this.counter++;

				if (this.counter === 8)
				{
					this.counter 	= 0;
					this.setState({ overlayIsPressed: false })
				}
			}

		}, 1000);
	}

	componentWillUnmount = () => {
		clearInterval(this.interval);
		clearInterval(this.tickInterval);
	}
	
	componentWillMount = () => {
		this.getOrigin();
		this.getAutoStatus();
		this.getFirebaseData();
		this.calculateTotalTime();
	}

	CheckAlarm = () => {
		if (this.state.totalTime.toLocaleTimeString() === new Date().toLocaleTimeString())
		{
			this.setState({ alarmIsPlaying: true });
		}
	}

	getAutoStatus = () => {
		// Check if auto alarm is enabled.
		db.collection('api-data').doc('maps-data').onSnapshot(res => {
			this.setState({ autoCalculateIsOn: res.data().enabled })
		});
	}

	getFirebaseData = () => {
		// Get departure time/
		db.collection('api-data').doc('maps-data').onSnapshot(res => {
			var date 	= new Date(1970, 0, 1);
			date.setSeconds(res.data().departure_time.seconds);
			this.setState({ departureTime: date });
		});

		// Get location, start_time and start_date
		db.collection('api-data').doc('calendar-data').onSnapshot(res => {
			this.setState({ 
				destination: res.data().location,
				start_date: res.data().start_date,
				start_time: res.data().start_time,
			});

			if (this.state.snoozyLocation !== '') this.calculateTraffic(res.data().location)
		})
	}


	// Converts IP or geolocation to address.
	getAddress = (latitude, longitude) => {
		const url 	= 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + latitude + ',' + longitude + '&key=' + GOOGLE_MAP_KEY;

		axios.get(url).then(res => {
			this.setState({ snoozyLocation: res.data.results[0].formatted_address })
		}).catch(err => {
			console.log('Request failed.  Returned status of', err);
		});
	}
	

	getOriginWithIp = () => {
		axios.get('http://ip-api.com/json')
			.then(res => {
				console.log(res);
				console.log('User\'s Location Data is ', res);
				console.log('User\'s Country ', res.country);
				this.getAdress(res.lat, res.lon);
			})
			.catch(err => {
				console.log('Request failed.  Returned status of ', err);
			});
	}

	getOrigin = () => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition((res) => {
				const lat 	= res.coords.latitude;
				const long 	= res.coords.longitude

				this.getAddress(lat, long);
			}, (err) => {
				console.log(err);
			})
		} else {
			console.log('geolocation is not enabled')
			this.getOriginWithIp();
		}
	}

	calculateTraffic = (from) => {
		const origin                = this.state.snoozyLocation;
		const destination           = from;
		const calendarStartDate     = new Date(this.state.start_date + 'T' + this.state.start_time + '');
		const service               = new google.maps.DistanceMatrixService();

		// Get traffic data.
		service.getDistanceMatrix({
			origins: [ origin ],
			destinations: [ destination ],
			travelMode: google.maps.TravelMode.DRIVING,
			unitSystem: google.maps.UnitSystem.METRIC,
			drivingOptions: {
				departureTime: calendarStartDate,
				trafficModel: 'bestguess'
			}
		}, (response, status) => {
			// Set traffic response to state.
			if (status === 'OK')
			{
				db.collection('api-data').doc('maps-data').update({
					to: destination,
					from: origin,
					enabled: true,
					arrival_time: calendarStartDate,
					distance: response.rows[0].elements[0].distance.text,
					duration: response.rows[0].elements[0].duration.text,
					duration_in_traffic: response.rows[0].elements[0].duration_in_traffic.text,
				});
	
				calendarStartDate.setMinutes(calendarStartDate.getMinutes() - parseInt(response.rows[0].elements[0].duration_in_traffic.text));
	
				// Set departure_time to Firebase.
				db.collection('api-data').doc('maps-data').set({
					departure_time: calendarStartDate,
				}, { merge: true });
			}
		});
	}

	calculateTotalTime = () => {
		// Calculate alarm time.
		db.collection('user-data').onSnapshot(docs => {
			docs.forEach(doc => {
				const timeFromFb 	= doc.data().time_needed
				const hours 		= parseInt(timeFromFb.split(':')[0]);
				const minutes 		= parseInt(timeFromFb.split(':')[1])

				const newDate 		= this.state.departureTime;

				newDate.setUTCHours(newDate.getHours() - hours);
				newDate.setUTCMinutes(newDate.getMinutes() - minutes);

				this.setState({ totalTime: newDate });
			});
		});
	}
	
	render() {
		return (
			<div className="App">
 				<Overlay 
					onOverlayPress={ () => { this.setState({ overlayIsPressed: true }) } } 
					active={ this.state.overlayIsPressed }
				/>
		
				<div className="all">
					<BigClock />
					<Alarm time={ this.state.totalTime }/>
					
					<NotificationsOverview active={ this.state.overlayIsPressed }/>

					<Sound 
						url={ Buzz }
						playStatus={ this.state.alarmIsPlaying ? Sound.status.PLAYING : Sound.status.STOPPED }
						loop={ true }
					/>
				</div>
			</div>
		);
	}
}

export default App;
