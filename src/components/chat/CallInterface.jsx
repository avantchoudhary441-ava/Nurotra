import React, { useEffect, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CallInterface = () => {
    const {
        call,
        callAccepted,
        myVideo,
        userVideo,
        stream,
        callEnded,
        leaveCall,
        answerCall,
        isCalling
    } = useSocket();

    const [isMuted, setIsMuted] = useState(false);

    // Toggle Mute
    const toggleMute = () => {
        if (stream) {
            stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
            setIsMuted(!stream.getAudioTracks()[0].enabled);
        }
    };

    // Render nothing if no call activity
    if (!call.isReceivingCall && !isCalling && !callAccepted) return null;

    // Safety check just in case
    if (callEnded && !call.isReceivingCall && !isCalling) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="call-overlay"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
            >
                {/* Incoming Call Popup */}
                {call.isReceivingCall && !callAccepted && (
                    <div className="incoming-call-card">
                        <div className="pulsating-avatar">
                            <img src={call.picture || "https://via.placeholder.com/150"} alt="Caller" />
                        </div>
                        <h3>{call.name || "Unknown"} is calling...</h3>
                        <div className="call-actions">
                            <button className="answer-btn" onClick={answerCall}>
                                <Phone size={24} /> Answer
                            </button>
                            <button className="decline-btn" onClick={leaveCall}>
                                <PhoneOff size={24} /> Decline
                            </button>
                        </div>
                    </div>
                )}

                {/* Active Call UI (Making Call or In Call) */}
                {(isCalling || callAccepted) && (
                    <div className="active-call-card">
                        {/* Remote User Audio (Invisible but functional) */}
                        <video playsInline ref={userVideo} autoPlay className="hidden-video" />

                        {/* Local User Audio (Muted locally to prevent echo) */}
                        <video playsInline muted ref={myVideo} autoPlay className="hidden-video" />

                        <div className="call-status">
                            {callAccepted ? "Connected" : "Calling..."}
                        </div>

                        <div className="call-visualizer">
                            <div className="wave-container">
                                <div className="wave"></div>
                                <div className="wave"></div>
                                <div className="wave"></div>
                            </div>
                            <img
                                src={call.picture || "https://via.placeholder.com/150"}
                                alt="Partner"
                                className="call-avatar"
                            />
                        </div>

                        <div className="call-controls">
                            <button className={`control-btn ${isMuted ? 'muted' : ''}`} onClick={toggleMute}>
                                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                            </button>
                            <button className="control-btn end-call-btn" onClick={leaveCall}>
                                <PhoneOff size={24} />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default CallInterface;
