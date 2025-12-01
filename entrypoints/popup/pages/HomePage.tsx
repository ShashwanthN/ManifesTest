import { Home, History, Settings, FilePlus, Search, Layers, HelpCircle , X } from 'lucide-react';
import TestTypeButtons, { TestType } from '../components/TestTypeButtons';
import VerticalSlider from '../components/VerticalSlider';
import icon from '../../../assets/Icon.png';

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

  // NEW: handler to dismiss the answer pane (clears the llm response in parent)
  onDismissAnswer: () => void;
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
  isTestGenerationRequest,
  onDismissAnswer
}: HomePageProps) {
  return (
    <div className="w-full h-full bg-[#1A1A1A] flex flex-col relative" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className='flex justify-between items-center px-4 pt-6 pb-4'>
        <div className='flex items-center gap-2'>
          <button className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'>
            <Home className='w-5 h-5 text-gray-400' />
          </button>
          <h1 className="text-[16px] text-neutral-200 font-normal">
            Manifes<span className='font-normal italic text-yellow-400'>T</span><span className='text-yellow-400'>est</span>
          </h1>
        </div>
        <div className='flex items-center gap-2'>
          <button 
            onClick={onShowHistoryToggle}
            className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'
          >
            <History className='w-5 h-5 text-gray-400' />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 py-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center mx-auto space-y-4 w-full">
          {/* Welcome Section */}
          <div className="text-start space-y-1 pl- pb-3">
            <h1 className="text-2xl text-white font-light font-stretch-expanded font-serif">
              Create a Test
            </h1>
            <p className="text-start justify-self-auto text-neutral-400">
              {error || 'Select options below and generate questions from the current page'}
            </p>
          </div>

          {/* Test Configuration Card */}
          <div className='bg-linear-to-br from-[#17171700] via-[#25252500] to-[#1f1f1f00] flex items-center justify-between w-full max-w-2xl border border-[#2f2f33] rounded-2xl py-4 px-5 gap-6 shadow-md relative overflow-hidden' >
            <div className='absolute left-0 top-0 h-full w-1 bg-linear-to-b from-transparent via-[#ffffff10] to-transparent opacity-30 pointer-events-none rounded-l-2xl' />
            <div className='absolute right-0 bottom-0 h-full w-1 bg-linear-to-b from-transparent via-[#ffffff08] to-transparent opacity-25 pointer-events-none rounded-r-2xl' />

            <div className='flex items- gap-4 z-10 min-w-0'>
              <div className='flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 shrink-0'>
                <Layers className='w-5 h-5 text-slate-300' />
              </div>
              <div className='min-w-0'>
                <div className='mb-1'>
                  <TestTypeButtons 
                    selectedTypes={selectedTypes} 
                    onToggleType={onToggleTestType}
                  />
                </div>
              </div>
            </div>

            <div className='h-20 pb-0 w-px bg-linear-to-b from-[#3a3a3a] via-[#2f2f2f] to-[#3a3a3a] opacity-60' />

            <div className='flex items- gap-4 z-10 min-w-0'>
              <div className='flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 shrink-0'>
                <HelpCircle className='w-5 h-5 text-slate-300' />
              </div>
              <div className='min-w-0'>
                <div className='flex items-center'>
                  <VerticalSlider
                    min={3}
                    max={20}
                    value={numQuestions}
                    onChange={onNumQuestionsChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className='w-full max-w-2xl'>
            <button
              disabled={loading || selectedTypes.size === 0}
              onClick={onGenerateMCQs}
              className='w-full px-6 py-3 rounded-full bg-yellow-500 font-serif text-black font-light border border-yellow-500 hover:border-yellow-500 hover:border hover:bg-yellow-900 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center text-base'
            >
              {loading ? (
                <>
                  <div className='w-4 h-4 border-2 border-black  border-t-transparent rounded-full animate-spin mr-2' />
                  Generating...
                </>
              ) : (
                <>Generate Test</>
              )}
            </button>
          
            {loading && (
              <button
                onClick={onReset}
                className='w-full px-6 py-2.5 rounded-full bg-red-500 text-white font-bold hover:bg-red-400 transition-colors text-sm mt-3'
              >
                Cancel Generation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Input Prompt Section */}
      <div className='px-4 pb-6 pt-6 border-t border-[#2b2b2b]'>
        <div className='space-y-1.5'>
          <div className='flex items-center gap-3'>
            <div className='flex-1'>
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
                  className='w-8 h-8 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors disabled:opacity-50 shrink-0'
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
                    <div className='shrink-0'>
                      <img src={icon} alt='App icon' className='w-6 h-6 p-1 border-neutral-800 object-cover' />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ===== Removed duplicate "LLM Loading State" block to avoid two identical dot indicators ===== */}

          {/* LLM Response (with dismiss button) */}
          {llmResponse && !llmLoading && (
            <div className='rounded-xl p-4 bg-[#202020] border border-[#3d3d3d] max-h-48 overflow-y-auto relative'>
              {/* Dismiss button (closes the whole answer area) */}
              <button
                onClick={onDismissAnswer}
                className='absolute right-3 top-3 w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/6'
                aria-label='Dismiss answer'
              >
                <X className='w-4 h-4 text-neutral-400' />
              </button>

              <div className='flex items-start gap-2 mb-2'>
                <div className='w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0'>
                  {/* aligned vertically with flex container */}
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
  );
}
