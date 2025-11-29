import { Home, History, Settings, Save, Maximize2 } from 'lucide-react';

interface PreviewPageProps {
  testData: any;
  isSaving: boolean;
  showHistory: boolean;
  onGoHome: () => void;
  onShowHistoryToggle: () => void;
  onSaveTest: () => void;
  onStartTest: () => void;
}

export default function PreviewPage({
  testData,
  isSaving,
  showHistory,
  onGoHome,
  onShowHistoryToggle,
  onSaveTest,
  onStartTest
}: PreviewPageProps) {
  return (
    <div className="w-full h-full bg-[#1A1A1A] flex flex-col relative" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className='flex justify-between items-center px-4 pt-3 pb-2'>
        <div className='flex items-center gap-2'>
          <button 
            onClick={onGoHome}
            className='w-9 h-9 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'
          >
            <Home className='w-4 h-4 text-gray-400' />
          </button>
          <button 
            onClick={onShowHistoryToggle}
            className='w-9 h-9 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'
          >
            <History className='w-4 h-4 text-gray-400' />
          </button>
        </div>
        <h1 className="text-xs text-gray-300 font-medium">
          ManifesTest - {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </h1>
        <button className='w-9 h-9 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'>
          <Settings className='w-4 h-4 text-gray-400' />
        </button>
      </div>

      {/* Main Content */}
      <div className='flex-1 flex flex-col px-4 py-2 overflow-y-auto'>
        <div className='w-full mx-auto space-y-3 flex-1 flex flex-col'>
          {/* Title Section */}
          <div className='text-center space-y-1'>
            <h1 className="text-2xl font-bold text-white">
              {testData.source_title?.split('|')[0]?.trim() || 'Test'}
            </h1>
            <p className="text-gray-400 text-xs">
              {testData.source_title?.split('|').slice(1).join('|').trim() || ''}
            </p>
          </div>

          {/* Time and Marks */}
          <div className='flex justify-between text-gray-300 text-sm'>
            <span>Time: 10 min</span>
            <span>Max. Marks: {testData.questions.length}</span>
          </div>

          {/* Instructions */}
          <div className='text-gray-300 space-y-1'>
            <p className='font-medium text-sm'>Instructions:</p>
            <ol className='list-decimal list-inside space-y-0.5 text-xs ml-2'>
              <li>All questions are compulsory.</li>
              <li>You will have MCQs, Truth or False and Fill in the Blanks as part of the test.</li>
              <li>Click the yellow button on the bottom right to fullscreen.</li>
            </ol>
          </div>

          {/* Action Container */}
          <div className='w-full rounded-2xl p-4 bg-[#202020] border border-[#3d3d3d] flex items-center justify-center mt-2'>
            {/* Buttons */}
            <div className='flex items-center gap-4'>
              <button 
                onClick={onSaveTest}
                disabled={isSaving}
                className='px-6 py-2 bg-white hover:bg-gray-100 text-black font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 text-sm'
              >
                <Save className='w-3.5 h-3.5' />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button 
                onClick={onStartTest}
                className='px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors text-sm'
              >
                Start Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Timer and Fullscreen Button */}
      <div className='flex justify-between items-center px-4 py-2 border-t border-gray-800'>
        {/* Timer at bottom left */}
        <div className='text-3xl font-bold text-white'>
          10:00
        </div>
        
        {/* Fullscreen button at bottom right */}
        <button 
          onClick={() => {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen();
            }
          }}
          className='w-12 h-12 bg-yellow-500 hover:bg-yellow-400 rounded-xl flex items-center justify-center transition-colors'
        >
          <Maximize2 className='w-5 h-5 text-black' />
        </button>
      </div>
    </div>
  );
}

