// hooks/useModalBack.ts
import { useEffect } from 'react';

export function useModalBack(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    // 1. Push a dummy state to the browser history when modal opens
    window.history.pushState({ isModalOpen: true }, '');

    // 2. Handle the back gesture/button
    const handlePopState = () => {
      // The browser already popped the state, so we just close the UI
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    // 3. Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
      
      // If the modal was closed via a UI button (not the back gesture),
      // the dummy state is still in history. We need to remove it.
      if (window.history.state?.isModalOpen) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);
}