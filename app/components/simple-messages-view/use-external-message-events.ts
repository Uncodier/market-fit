import { useEffect, useRef } from "react"

export function useExternalMessageEvents(setMessage: (message: string) => void, handleSendMessage: () => void) {
  // Use refs for message handlers to avoid stale closures in event listeners
  const setMessageRef = useRef(setMessage);
  const handleSendMessageRef = useRef(handleSendMessage);
  
  useEffect(() => {
    setMessageRef.current = setMessage;
    handleSendMessageRef.current = handleSendMessage;
  }, [setMessage, handleSendMessage]);

  // Custom event listener for external components to send messages
  useEffect(() => {
    const handleRobotSendMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      if (customEvent.detail && customEvent.detail.text) {
        setMessageRef.current(customEvent.detail.text);
        setTimeout(() => {
          handleSendMessageRef.current();
        }, 100);
      }
    };
    
    const handleRobotSendQueryFromUrl = (event: Event) => {
      const customEvent = event as CustomEvent<{ query: string }>;
      if (customEvent.detail && customEvent.detail.query) {
        // Change the query into the standard format if it's the specific format from the prompt, 
        // to avoid infinite loops and give the input component time to mount
        const queryText = customEvent.detail.query;
        
        // Use a slight delay to ensure UI is ready
        setTimeout(() => {
          setMessageRef.current(queryText);
          
          // Small delay before firing submit so React can update the textarea
          setTimeout(() => {
            handleSendMessageRef.current();
          }, 300);
        }, 300);
      }
    };
    
    window.addEventListener('robot:send-message', handleRobotSendMessage);
    window.addEventListener('robot:send-query-from-url', handleRobotSendQueryFromUrl);
    
    return () => {
      window.removeEventListener('robot:send-message', handleRobotSendMessage);
      window.removeEventListener('robot:send-query-from-url', handleRobotSendQueryFromUrl);
    };
  }, []); // Empty deps since we use refs for the callbacks

}
