import React, { useEffect, useState } from 'react';
import { MicOff, Video } from 'lucide-react';

// More realistic avatars from Unsplash
const AVATARS = [
  { src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop", name: "Sarah J." },
  { src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop", name: "Michael C." },
  { src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop", name: "David L." },
  { src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop", name: "Emily R." },
  { src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop", name: "James T." },
];

const EMOJIS = ["😐", "🙂", "🤔", "🤨", "🖊️", "👀", "👏", "😊"];

interface AudienceMemberProps {
  imgSrc: string;
  name: string;
}

const AudienceMember: React.FC<AudienceMemberProps> = ({ imgSrc, name }) => {
  const [emoji, setEmoji] = useState("");

  useEffect(() => {
    // Random reactions
    const interval = setInterval(() => {
      // 30% chance to show a reaction
      if (Math.random() > 0.7) {
        const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        setEmoji(randomEmoji);
        // Clear emoji after 2 seconds
        setTimeout(() => setEmoji(""), 2000);
      }
    }, 3000 + Math.random() * 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-sm group">
      <img src={imgSrc} alt={name} className="w-full h-full object-cover" />
      
      {/* Reaction Overlay */}
      {emoji && (
        <div className="absolute top-2 left-2 text-2xl animate-bounce drop-shadow-md z-10">
          {emoji}
        </div>
      )}

      {/* Name Tag */}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-1 rounded flex items-center gap-2">
        <MicOff size={10} className="text-red-500" />
        <span className="font-medium truncate max-w-[80px]">{name}</span>
      </div>
    </div>
  );
};

interface Props {
  userVideo?: React.ReactNode;
}

export const VirtualAudience: React.FC<Props> = ({ userVideo }) => {
  return (
    <div className="w-full h-full grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 auto-rows-fr">
      {/* Render Audience */}
      {AVATARS.map((p, idx) => (
        <div key={idx} className="aspect-video">
           <AudienceMember imgSrc={p.src} name={p.name} />
        </div>
      ))}
      
      {/* Render User Tile */}
      <div className="aspect-video relative bg-slate-900 rounded-lg overflow-hidden border-2 border-blue-500/50 shadow-lg order-first md:order-last">
          {userVideo ? (
            userVideo
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              <Video size={32} />
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] md:text-xs px-2 py-1 rounded flex items-center gap-2 z-20">
            <span className="font-medium">You (Speaker)</span>
          </div>
      </div>
    </div>
  );
};