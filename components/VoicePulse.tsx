
import React from 'react';

interface VoicePulseProps {
  isActive: boolean;
  color: string;
}

const VoicePulse: React.FC<VoicePulseProps> = ({ isActive, color }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {isActive && (
        <>
          <div className={`absolute w-16 h-16 rounded-full animate-ping opacity-20 ${color}`} />
          <div className={`absolute w-20 h-20 rounded-full animate-ping opacity-10 ${color}`} style={{ animationDelay: '0.5s' }} />
          <div className={`absolute w-24 h-24 rounded-full animate-ping opacity-5 ${color}`} style={{ animationDelay: '1s' }} />
        </>
      )}
    </div>
  );
};

export default VoicePulse;
