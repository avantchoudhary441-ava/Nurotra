import { useReducer, useCallback, useState } from 'react';

/**
 * Reducer for managing chat state.
 * msgHistory: What we send to the API (real turns only).
 * messages: What we show in the UI (includes initial greeting).
 */
const chatReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, { role: 'user', content: action.payload }],
        apiHistory: [...state.apiHistory, { role: 'user', content: action.payload }]
      };
    case 'ADD_ASSISTANT_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, { role: 'assistant', ...action.payload }],
        apiHistory: [...state.apiHistory, { role: 'assistant', content: action.payload.message || action.payload.content?.[0]?.text }]
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return { 
        messages: [{ role: 'assistant', content: state.initialGreeting }], 
        apiHistory: [], 
        error: null 
      };
    default:
      return state;
  }
};

/**
 * useAgentChat()
 * Manages full multi-turn conversation state for the Communication Agent.
 */
export function useAgentChat(initialGreeting = "Hello! I'm your Communication Agent. How can I help you today?") {
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [{ role: 'assistant', content: initialGreeting }],
    apiHistory: [], // Only tracks actual API exchanges
    initialGreeting,
    error: null
  });

  const [loading, setLoading] = useState(false);

  const send = useCallback(async (text) => {
    if (!text.trim()) return;

    dispatch({ type: 'ADD_USER_MESSAGE', payload: text });
    dispatch({ type: 'SET_ERROR', payload: null });
    setLoading(true);

    try {
      const userData = localStorage.getItem('nurotra_user');
      const token = userData ? JSON.parse(userData).token : null;
      
      const response = await fetch('http://localhost:5000/api/communication/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          prompt: text,
          history: state.apiHistory 
        })
      });

      if (!response.ok) {
        let errorMsg = "Connection error. Please check your network.";
        try {
          const data = await response.json();
          errorMsg = data.message || data.error?.message || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      // The new endpoint returns 'message' and 'content' for compatibility
      const replyText = data.message || (data.content && data.content[0]?.text) || "Done.";

      dispatch({ type: 'ADD_ASSISTANT_MESSAGE', payload: data });
      
      // Optional: Return the raw data if the component needs it (e.g., for action results)
      return data;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      console.error("[useAgentChat] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [state.apiHistory]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { 
    messages: state.messages, 
    send, 
    loading, 
    error: state.error, 
    reset 
  };
}
