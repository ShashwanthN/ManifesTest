import { Home, History, Settings, FilePlus, Search } from 'lucide-react';
import TestTypeButtons, { TestType } from '../components/TestTypeButtons';
import VerticalSlider from '../components/VerticalSlider';

interface HomePageProps {
  selectedTypes: Set<TestType>;
  numQuestions: number;
  loading: boolean;
  error: string;
  inputPrompt: string;
  llmResponse: string;
  llmLoading: boolean;
  showHistory: boolean;
  onToggleTestType: (type: TestType) => void;
  onNumQuestionsChange: (value: number) => void;
  onGenerateMCQs: () => void;
  onLLMQuestion: () => void;
  onInputPromptChange: (value: string) => void;
  onShowHistoryToggle: () => void;
  onReset: () => void;
  isTestGenerationRequest: (prompt: string) => boolean;
}

export default function HomePage({
  selectedTypes,
  numQuestions,
  loading,
  error,
  inputPrompt,
  llmResponse,
  llmLoading,
  showHistory,
  onToggleTestType,
  onNumQuestionsChange,
  onGenerateMCQs,
  onLLMQuestion,
  onInputPromptChange,
  onShowHistoryToggle,
  onReset,
  isTestGenerationRequest
}: HomePageProps) {
  return (
    <div className="w-full h-full bg-[#1A1A1A] flex flex-col relative" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className='flex justify-between items-center px-6 pt-6 pb-4'>
        <div className='flex items-center gap-2'>
          <button className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'>
            <Home className='w-5 h-5 text-gray-400' />
          </button>
          <h1 className="text-[16px] text-neutral-200 font-medium">
            Manifes<span className='font-bold italic text-yellow-400'>T</span><span className='text-yellow-400'>est</span>
          </h1>
        </div>
        <div className='flex items-center gap-2'>
          <button 
            onClick={onShowHistoryToggle}
            className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'
          >
            <History className='w-5 h-5 text-gray-400' />
          </button>
          <button className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'>
            <Settings className='w-5 h-5 text-gray-400' />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-6 py-3 overflow-y-auto">
        <div className="w-full mx-auto space-y-4">
          {/* Welcome Section */}
          <div className="text-center space-y-1">
            <h1 className="text-xl text-white font-bold">
              Create Your Test
            </h1>
            <p className="text-xs text-gray-400">
              {error || 'Select options below and generate questions from the current page'}
            </p>
          </div>

          {/* Test Configuration Card */}
          <div className='bg-[#202020] flex justify-around border border-[#3d3d3d] rounded-2xl pt-4 px-4 space-y-4'>
            {/* Test Types Section */}
            <div className='space-y-2'>
              <TestTypeButtons 
                selectedTypes={selectedTypes} 
                onToggleType={onToggleTestType}
              />
            </div>

            {/* Divider */}
            <div className='h-px bg-[#3d3d3d]' />

            {/* Number of Questions Section */}
            <div className='space-y-2'>
              <div className='flex items-center gap-3'>
                <VerticalSlider
                  min={3}
                  max={20}
                  value={numQuestions}
                  onChange={onNumQuestionsChange}
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            disabled={loading || selectedTypes.size === 0}
            onClick={onGenerateMCQs}
            className='w-full px-6 py-3 rounded-full bg-yellow-500 text-black font-bold hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center text-base shadow-lg'
          >
            {loading ? (
              <>
                <div className='w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2' />
                Generating...
              </>
            ) : (
              <>
                <FilePlus className='w-4 h-4 mr-2' />
                Generate Test
              </>
            )}
          </button>
          
          {loading && (
            <button
              onClick={onReset}
              className='w-full px-6 py-2.5 rounded-full bg-red-500 text-white font-bold hover:bg-red-400 transition-colors text-sm'
            >
              Cancel Generation
            </button>
          )}

          {/* Input Prompt Section */}
          <div className='space-y-1.5'>
            <p className="text-xs text-gray-400 font-medium">Ask LLM or generate test</p>
            <div className='rounded-xl px-3 py-2 bg-[#202020] border border-[#3d3d3d] flex items-center gap-2'>
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => onInputPromptChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading && !llmLoading && inputPrompt.trim()) {
                    if (isTestGenerationRequest(inputPrompt)) {
                      onGenerateMCQs();
                    } else {
                      onLLMQuestion();
                    }
                  }
                }}
                placeholder='Ask a question or type a test topic...'
                className='bg-transparent flex-1 outline-none text-neutral-300 placeholder-neutral-500 text-xs'
                disabled={loading || llmLoading}
              />
              <button
                className='w-7 h-7 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors disabled:opacity-50 shrink-0'
                onClick={() => {
                  if (!inputPrompt.trim() || loading || llmLoading) return;
                  if (isTestGenerationRequest(inputPrompt)) {
                    onGenerateMCQs();
                  } else {
                    onLLMQuestion();
                  }
                }}
                disabled={loading || llmLoading || !inputPrompt.trim()}
              >
                {llmLoading ? (
                  <div className='flex gap-0.5'>
                    <div className='w-1 h-1 bg-yellow-500 rounded-full animate-bounce' style={{ animationDelay: '0ms' }} />
                    <div className='w-1 h-1 bg-yellow-500 rounded-full animate-bounce' style={{ animationDelay: '150ms' }} />
                    <div className='w-1 h-1 bg-yellow-500 rounded-full animate-bounce' style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <Search className='w-3.5 h-3.5 text-yellow-500' strokeWidth={2.5} />
                )}
              </button>
            </div>
            
            {/* LLM Loading State */}
            {llmLoading && (
              <div className='rounded-xl p-4 bg-[#202020] border border-[#3d3d3d]'>
                <div className='flex items-center gap-3'>
                  <div className='flex gap-1'>
                    <div className='w-2 h-2 bg-yellow-500 rounded-full animate-bounce' style={{ animationDelay: '0ms' }} />
                    <div className='w-2 h-2 bg-yellow-500 rounded-full animate-bounce' style={{ animationDelay: '150ms' }} />
                    <div className='w-2 h-2 bg-yellow-500 rounded-full animate-bounce' style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className='text-xs text-gray-400'>Getting answer...</span>
                </div>
              </div>
            )}
            
            {/* LLM Response */}
            {llmResponse && !llmLoading && (
              <div className='rounded-xl p-4 bg-[#202020] border border-[#3d3d3d] max-h-48 overflow-y-auto'>
                <div className='flex items-start gap-2 mb-2'>
                  <div className='w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0 mt-0.5'>
                    <Search className='w-3 h-3 text-yellow-500' />
                  </div>
                  <p className="text-xs text-gray-400 font-medium">Answer:</p>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap ml-7 leading-relaxed">{llmResponse}</p>
              </div>
            )}
            
            {/* Error State */}
            {error && !llmResponse && !llmLoading && error.length > 50 && (
              <div className='rounded-xl p-3 bg-[#202020] border border-red-500/30 max-h-32 overflow-y-auto'>
                <p className="text-xs text-red-400 whitespace-pre-wrap">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

