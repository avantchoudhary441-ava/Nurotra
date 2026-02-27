import React, { createContext, useState, useRef, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import { useAuth } from './AuthContext';
import { useNuroCore } from './NuroCoreContext';

const SocketContext = createContext();

// Use environment variable or fallback for socket URL
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const SocketProvider = ({ children }) => {
    const { user, token } = useAuth();
    const { setHasUnreadMessages } = useNuroCore();
    const [stream, setStream] = useState(null);
    const [me, setMe] = useState('');
    const [call, setCall] = useState({});
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [currentCaller, setCurrentCaller] = useState("");
    const [isCalling, setIsCalling] = useState(false);

    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();
    const socket = useRef();

    useEffect(() => {
        // Initialize socket once
        if (!socket.current) {
            socket.current = io(SOCKET_URL, {
                transports: ['websocket'], // Force websocket to avoid polling issues
                reconnection: true,
            });

            socket.current.on('connect', () => {
                console.log("Socket Connected:", socket.current.id);
                setMe(socket.current.id);
            });

            socket.current.on('connect_error', (err) => {
                console.error("Socket Connection Failed:", err);
            });

            socket.current.on('call-user', ({ from, name: callerName, signal, picture, context }) => {
                setCall({ isReceivingCall: true, from, name: callerName, signal, picture, context });
                setCurrentCaller(from);
            });

            socket.current.on("call-ended", () => {
                leaveCall();
            });

            socket.current.on('message received', (newMessage) => {
                // Check if we are NOT on the chat page or if the chat is not open
                if (!window.location.pathname.includes('/chat')) {
                    setHasUnreadMessages(true);
                }
            });
        }

        // Handle User Mapping updates
        if (user && socket.current) {
            socket.current.emit("join-room", user._id);
        }

    }, [user, token]);

    const answerCall = () => {
        setCallAccepted(true);

        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            .then((currentStream) => {
                setStream(currentStream);
                if (myVideo.current) {
                    myVideo.current.srcObject = currentStream;
                }

                const peer = new Peer({ initiator: false, trickle: false, stream: currentStream });

                peer.on('signal', (data) => {
                    socket.current.emit('answer-call', { signal: data, to: call.from });
                });

                peer.on('stream', (currentStream) => {
                    if (userVideo.current) {
                        userVideo.current.srcObject = currentStream;
                    }
                });

                peer.signal(call.signal);
                connectionRef.current = peer;
            })
            .catch(err => console.error("Error accessing media devices:", err));
    };

    const callUser = (id, partnerName, partnerPic, partnerContext = {}) => {
        setIsCalling(true);
        setCallEnded(false);
        // Set local call state immediately so UI shows who we are calling
        setCall({ isReceivingCall: false, name: partnerName, picture: partnerPic, context: partnerContext });

        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            .then((currentStream) => {
                setStream(currentStream);
                if (myVideo.current) {
                    myVideo.current.srcObject = currentStream;
                }

                if (!socket.current) {
                    throw new Error("Socket connection lost");
                }

                const peer = new Peer({ initiator: true, trickle: false, stream: currentStream });

                if (!peer) {
                    throw new Error("Peer creation failed");
                }

                peer.on('signal', (data) => {
                    if (socket.current) {
                        // Context about ME to send to THEM
                        const myContext = {
                            role: user.role,
                            isVerified: user.isVerified,
                            uniqueId: user.uniqueId
                            // matchScore: calculated on their end or passed here if we knew it? 
                            // Usually receiver calculates match score based on caller ID. 
                            // But for simplicity let's rely on what we have.
                        };

                        socket.current.emit('call-user', {
                            userToCall: id,
                            signalData: data,
                            from: user._id,
                            name: user.name,
                            picture: user.profileImg,
                            context: myContext
                        });
                    }
                });

                peer.on('stream', (remoteStream) => {
                    if (userVideo.current) {
                        userVideo.current.srcObject = remoteStream;
                    }
                });

                peer.on('error', (err) => {
                    console.error("Peer Error:", err);
                    leaveCall();
                });

                socket.current.on('call-accepted', (signal) => {
                    setCallAccepted(true);
                    peer.signal(signal);
                });

                connectionRef.current = peer;
            })
            .catch(err => {
                console.error("Call Setup Error:", err);
                setIsCalling(false);
            });
    };

    const leaveCall = () => {
        setCallEnded(true);
        setCallAccepted(false);
        setIsCalling(false);
        setCall({});

        if (connectionRef.current) {
            connectionRef.current.destroy();
        }

        // Stop all tracks
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }

        // Notify other user
        if (callAccepted && currentCaller) {
            socket.current.emit("end-call", { to: currentCaller });
        } else if (isCalling && currentCaller) {
            // If I was the caller
            // We need to know who we were calling to send end signal, 
            // but current implementation might lack keeping track of 'who I called' easily 
            // without extra state. For simplicity, just destroying local is key.
        }

        // Reload helps clear WebRTC artifacts sometimes, but let's try clean state reset first
        // window.location.reload(); 
    };

    return (
        <SocketContext.Provider value={{
            call,
            callAccepted,
            myVideo,
            userVideo,
            stream,
            name: me,
            setName: setMe,
            callEnded,
            me,
            callUser,
            leaveCall,
            answerCall,
            isCalling
        }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
