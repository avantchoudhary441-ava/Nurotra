import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, ShieldCheck, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/chat.css';

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
    const [duration, setDuration] = useState(0);
    const [showFeedback, setShowFeedback] = useState(false);

    // Call Timer
    useEffect(() => {
        let interval;
        if (callAccepted && !callEnded) {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [callAccepted, callEnded]);

    // Show Feedback on Call End
    useEffect(() => {
        if (callEnded && (call.isReceivingCall === false || callAccepted)) {
            setShowFeedback(true);
        }
    }, [callEnded]);

    // Toggle Mute
    const toggleMute = () => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleFeedback = (rating) => {
        // "Silent Intelligence" - Log outcome
        console.log(`Call with ${call.name} rated: ${rating}`);
        leaveCall();
        setShowFeedback(false);
    };

    // Render Logic
    if (showFeedback) {
        return (
            <AnimatePresence>
                <motion.div
                    className="call-overlay-feedback"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <div className="feedback-card">
                        <h3>Call Ended</h3>
                        <p>Was this call helpful?</p>
                        <div className="feedback-actions">
                            <button onClick={() => handleFeedback('helpful')} className="fb-btn helpful"><ThumbsUp size={24} /></button>
                            <button onClick={() => handleFeedback('not-helpful')} className="fb-btn not-helpful"><ThumbsDown size={24} /></button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        )
    }

    // Normal Call UI
    if (!call.isReceivingCall && !isCalling && !callAccepted) return null;

    // Safety
    if (callEnded && !showFeedback) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="call-overlay-hybrid"
                drag
                dragMomentum={false}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
            >
                {/* INCOMING CALL */}
                {call.isReceivingCall && !callAccepted && (
                    <div className="incoming-view">
                        <div className="pulsating-ring">
                            <img src={call.picture || "https://via.placeholder.com/150"} alt="Caller" className="caller-img-lg" />
                        </div>
                        <div className="context-layer">
                            <h2>{call.name || "Unknown"}</h2>
                            <p className="role-badge">{call.context?.role || "User"}</p>
                        </div>
                        <p className="call-status-text">Incoming Nurotra Call...</p>
                        <div className="action-row">
                            <button className="btn-decline" onClick={leaveCall}><PhoneOff size={24} /></button>
                            <button className="btn-answer" onClick={answerCall}><Phone size={24} /></button>
                        </div>
                    </div>
                )}

                {/* ACTIVE / CALLING UI */}
                {(isCalling || callAccepted) && (
                    <div className="active-view">
                        {/* Header Context Layer */}
                        <div className="call-header">
                            <div className="user-info-mini">
                                <span className="name">{call.name}</span>
                                {call.context?.isVerified && <ShieldCheck size={14} className="verified-icon" />}
                            </div>
                            <div className="call-timer">
                                <Clock size={12} /> {formatTime(duration)}
                            </div>
                        </div>

                        {/* Visualization Body */}
                        <div className="visualizer-body">
                            <img src={call.picture || "https://via.placeholder.com/150"} alt="User" className="active-avatar" />
                            <div className="role-pill">{call.context?.role || "Collaborator"}</div>
                            <div className="status-indicator">{callAccepted ? "On Call" : "Calling..."}</div>
                        </div>

                        {/* Hidden Audio Elements */}
                        <video playsInline ref={userVideo} autoPlay className="hidden-video" />
                        <video playsInline muted ref={myVideo} autoPlay className="hidden-video" />

                        {/* Footer Controls */}
                        <div className="controls-footer">
                            <button className={`ctrl-btn ${isMuted ? 'active-red' : ''}`} onClick={toggleMute}>
                                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                            </button>
                            <button className="ctrl-btn end-btn" onClick={() => { setShowFeedback(true); }}>
                                <PhoneOff size={24} />
                            </button>
                            <button className="ctrl-btn disabled">
                                <Volume2 size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default CallInterface;
