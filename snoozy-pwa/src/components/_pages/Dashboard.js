import React from 'react';
import Header from '../Header/Header';
import Appointment from '../Appointment/Appointment';
import SwitchButton from '../Buttons/SwitchButton';
import WarningBox from '../Boxes/WarningBox';
import ManualBox from '../Boxes/ManualBox';
import SideNavigation from '../SidebarNavigation/SideNavigation';
import { db } from '../../firebase/firebase';

class Dashboard extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            showWarningBox: false,
            setToManual: false,
            timeOnSubmit: '',
            ApiLoaded: false,

            start_time: '',
            start_date: '',
            user_time: '',

            autoCalculateIsOn: false
        };

        this.powerStatus    = false;
    }

    componentWillMount = () => {
        this.getAutoClock();
        this.calculateAlarm();
        this.getSnoozyStatus();
    }

    getAutoClock = () => {
        db.collection('api-data').doc('maps-data').onSnapshot(res => {
			this.setState({ autoCalculateIsOn: res.data().enabled })
		})
    }

    calculateAlarm = () => {
        db.collection('snoozy').doc('status').onSnapshot(res => {
            
        });
    }

    getSnoozyStatus = () => {
        db.collection('snoozy').doc('status').onSnapshot(res => {
            this.powerStatus    = res.data().power_status
            this.setState({ ApiLoaded: true, showWarningBox: this.powerStatus })
        });
    }

    timeOnSubmit = (time) => {
        console.log(time);
        this.setState({ timeOnSubmit: time });
    }

    renderManual = () => {
        if (this.state.setToManual)
        {
            return (
                <ManualBox 
                    onSubmit={ this.timeOnSubmit }
                    timeAfterSubmit={ this.state.timeOnSubmit }     
                />
            )
        }
    }

    togglePowerSnoozy = () => {
        this.powerStatus    = !this.powerStatus;

        this.setState({ showWarningBox: this.powerStatus });
        
        db.collection('snoozy').doc('status').update({
            power_status: this.powerStatus
        })
    }
    
    render = () => {
        return (
            <div className='Dashboard'>
				<Header />
                <SideNavigation />

                { this.state.ApiLoaded && !this.state.showWarningBox ? <WarningBox /> : '' }

                <div className="page_wrapper">
                    <Appointment />

                    {
                        this.state.ApiLoaded
                        ?
                        <SwitchButton 
                            onClick={() => this.setState({ setToManual: !this.state.setToManual })}
                            labelName='Automatische wekker'
                            defaultOn={ this.state.autoCalculateIsOn }
                        />
                        : 
                        ''
                    }

                    { this.renderManual() }

                    {
                        this.state.ApiLoaded
                        ?
                        <SwitchButton 
                            onClick={ this.togglePowerSnoozy }
                            labelName='Schakel je Snoozy in'
                            defaultOn={ this.powerStatus }
                        />
                        :
                        ''
                    }
                </div>
            </div>
        )
    }
}

export default Dashboard;