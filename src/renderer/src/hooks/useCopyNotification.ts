import { useState } from "react";

const useCopyNotification = () => {
  const [notificationState, setNotificationState] = useState({
    isVisible: false,
    position: { x: 0, y: 0 },
  });

  const copyText = async (text, event) => {
    try {
      window.api.clipboard.writeText(text);

      let x = window.innerWidth / 2;
      let y = window.innerHeight - 150;

      if (event?.clientX && event?.clientY) {
        x = event.clientX;
        y = event.clientY;
      } else if (event?.target) {
        const rect = event.target.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top;
      }

      setNotificationState({
        isVisible: true,
        position: { x, y },
      });
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const handleComplete = () => {
    setNotificationState((prev) => ({ ...prev, isVisible: false }));
  };

  return {
    notificationState,
    copyText,
    handleComplete,
  };
};
export default useCopyNotification;
