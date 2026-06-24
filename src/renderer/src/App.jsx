import React from 'react';
import LobbyPhase from './features/lobby/LobbyPhase';

function App() {
  return (
    <div className="relative w-full h-full min-h-screen bg-[#07060e] text-slate-100 flex items-center justify-center overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[10%] w-[450px] height-[450px] rounded-full bg-violet-600/10 blur-[140px] pointer-events-none animate-float-slow"></div>
      <div className="absolute bottom-[-15%] right-[5%] w-[500px] height-[500px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none animate-float-slow-reverse"></div>

      <main className="w-full h-full max-w-7xl mx-auto flex flex-col relative z-10">
        <LobbyPhase />
      </main>
    </div>
  );
}

export default App;
