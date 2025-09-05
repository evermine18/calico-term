import React, { useState, useEffect } from "react";
import { Check } from "lucide-react";

const CopyNotification = ({
  isVisible,
  onComplete,
  position = { x: 0, y: 0 },
}) => {
  const [phase, setPhase] = useState("hidden");

  useEffect(() => {
    if (isVisible) {
      setPhase("enter");

      const successTimer = setTimeout(() => {
        setPhase("success");
      }, 100);

      const hideTimer = setTimeout(() => {
        setPhase("exit");
      }, 1400);

      const completeTimer = setTimeout(() => {
        setPhase("hidden");
        onComplete?.();
      }, 1700);

      return () => {
        clearTimeout(successTimer);
        clearTimeout(hideTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [isVisible, onComplete]);

  if (!isVisible || phase === "hidden") return null;

  const getAnimationClasses = () => {
    switch (phase) {
      case "enter":
        return "opacity-0 scale-95 translate-y-1";
      case "success":
        return "opacity-100 scale-100 translate-y-0";
      case "exit":
        return "opacity-0 scale-105 translate-y-[-4px]";
      default:
        return "opacity-0 scale-95";
    }
  };

  const getIconClasses = () => {
    switch (phase) {
      case "enter":
        return "scale-75 opacity-60";
      case "success":
        return "scale-100 opacity-100";
      case "exit":
        return "scale-110 opacity-80";
      default:
        return "scale-100 opacity-100";
    }
  };

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 50}px`,
        transform: "translateX(-50%)",
      }}
    >
      <div
        className={`
        bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2
        flex items-center gap-2 text-sm text-gray-700
        transition-all duration-200 ease-out
        ${getAnimationClasses()}
      `}
      >
        <div
          className={`
          transition-all duration-150 ease-out
          ${getIconClasses()}
        `}
        >
          <Check className="w-4 h-4 text-green-600" />
        </div>
        <span className="font-medium">Copied</span>

        <div
          className={`
          w-1 h-1 bg-green-500 rounded-full transition-all duration-300
          ${phase === "success" ? "opacity-100 scale-100" : "opacity-0 scale-0"}
        `}
        />
      </div>

      {phase === "success" && (
        <div
          className="absolute inset-0 bg-green-50 rounded-md opacity-20 animate-pulse"
          style={{ animationDuration: "800ms", animationIterationCount: 1 }}
        />
      )}
    </div>
  );
};
export default CopyNotification;
