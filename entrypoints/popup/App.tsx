import { useState, useEffect } from 'react';
import { Clock, Settings, Plus, Search, FilePlus, ArrowLeft, Maximize2, X } from 'lucide-react';

function App() {
  const [screen, setScreen] = useState('home'); // 'home', 'preview', 'test', 'results'
  const [inputPrompt, setInputPrompt] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [topK, setTopK] = useState(3);
  const [testData, setTestData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [defaultTemp, setDefaultTemp] = useState(1.0);
  const [maxTopK, setMaxTopK] = useState(8);
  
  // Test state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<any>({});
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [testStarted, setTestStarted] = useState(false);
  const [testType, setTestType] = useState<string>('mcq');
  const [numQuestions, setNumQuestions] = useState(10);
  const [activeTabInfo, setActiveTabInfo] = useState<any>(null);

  useEffect(() => {
    loadSavedState();
    initDefaults();
  }, []);

  useEffect(() => {
    saveState();
  }, [inputPrompt, temperature, topK, testData, error]);

  // Timer effect
  useEffect(() => {
    if (testStarted && screen === 'test' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev: number) => {
          if (prev <= 1) {
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [testStarted, screen, timeLeft]);

  async function initDefaults() {
    try {
      if (!('LanguageModel' in self)) {
        return;
      }
      const defaults = await (self as any).LanguageModel.params();
      setDefaultTemp(defaults.defaultTemperature);
      setTemperature(defaults.defaultTemperature);
      const limitedTopK = defaults.defaultTopK > 3 ? 3 : defaults.defaultTopK;
      setTopK(limitedTopK);
      setMaxTopK(defaults.maxTopK);
    } catch (e: any) {
      console.error('Failed to init defaults:', e);
    }
  }

  async function runPrompt(prompt: string, params: any) {
    try {
      let currentSession = session;
      if (!currentSession) {
        currentSession = await (self as any).LanguageModel.create(params);
        setSession(currentSession);
      }
      return currentSession.prompt(prompt);
    } catch (e: any) {
      console.error('Prompt failed', e);
      reset();
      throw e;
    }
  }

  function reset() {
    if (session) {
      session.destroy();
    }
    setSession(null);
  }

  function extractJSON(text: string) {
    try {
      // First attempt: Try parsing the entire text as JSON
      try {
        return JSON.parse(text);
      } catch {
        // Continue to extraction methods
      }

      // Remove markdown code fences if present
      let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // Try parsing after removing code fences
      try {
        return JSON.parse(cleaned);
      } catch {
        // Continue to manual extraction
      }

      // Look for content between first { and last }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No JSON found in response');
      }
      
      const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
      
      // Try parsing the extracted portion directly
      try {
        return JSON.parse(jsonStr);
      } catch {
        // Last resort: try to fix common JSON issues
        const fixed = jsonStr
          .replace(/,\s*}/g, '}')  // Remove trailing commas before }
          .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
          .replace(/\n/g, ' ')     // Replace newlines with spaces
          .replace(/\r/g, '')      // Remove carriage returns
          .replace(/\t/g, ' ');    // Replace tabs with spaces
        
        return JSON.parse(fixed);
      }
    } catch (error: any) {
      console.error('JSON parsing error:', error);
      console.error('Failed text:', text);
      throw new Error(`Failed to parse response as JSON: ${error.message}`);
    }
  }

  async function handleGenerateMCQs() {
    setLoading(true);
    setError('');

    try {
      if (!chrome.scripting) {
        throw new Error('chrome.scripting API not available');
      }

      const page = await fetchActiveTabContent();
      setActiveTabInfo({ title: page.title, favicon: page.favicon });
      const pageText = `${page.title}\n\n${page.text}`.slice(0, 200000);

      const count = Math.max(3, Math.min(30, numQuestions));
      const baseHeader = `Output ONLY valid JSON (no markdown, no code fences).`;
      const generationPrompt = (testType === 'mcq')
        ? `Generate exactly ${count} multiple-choice questions from the content below.\n\n${baseHeader}\n\n{\n  "source_title": "title here",\n  "questions": [\n    {\n      "question": "question text",\n      "options": ["option A", "option B", "option C", "option D"],\n      "answer_index": 0\n    }\n  ]\n}\n\nRules:\n- answer_index must be 0, 1, 2, or 3\n- All questions must have exactly 4 options\n- Output valid JSON only\n\nContent:\n${pageText}`
        : (testType === 'true_false')
        ? `Generate exactly ${count} true/false questions from the content below.\n\n${baseHeader}\n\n{\n  "source_title": "title here",\n  "questions": [\n    {\n      "question": "statement text",\n      "answer": true\n    }\n  ]\n}\n\nRules:\n- answer must be true or false (boolean)\n- Output valid JSON only\n\nContent:\n${pageText}`
        : `Generate exactly ${count} fill-in-the-blank questions from the content below.\n\n${baseHeader}\n\n{\n  "source_title": "title here",\n  "questions": [\n    {\n      "question": "Sentence with a ____ blank",\n      "answer": "missing_word_or_phrase"\n    }\n  ]\n}\n\nRules:\n- Keep answers concise\n- Output valid JSON only\n\nContent:\n${pageText}`;


      if (!('LanguageModel' in self)) {
        const fallback = generateFallbackMCQs(page);
        setTestData(fallback);
        setScreen('preview');
        return;
      }

      const params = {
        initialPrompts: [
          { role: 'system', content: 'You generate valid JSON with no additional text.' }
        ],
        temperature: 0,
        topK: 1
      };

      let result;
      let parsed;
      let attempts = 0;
      const maxAttempts = 3;

      // Retry logic for more robust generation
      while (attempts < maxAttempts) {
        try {
          result = await runPrompt(generationPrompt, params);
          
          console.log(`Attempt ${attempts + 1} - Raw output:`, result);
          
          // Extract and parse JSON
          parsed = extractJSON(result);
          
          // Validate structure
          if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            throw new Error('Invalid question format');
          }
          
          // Success! Break out of retry loop
          console.log('Successfully parsed JSON:', parsed);
          break;
        } catch (e: any) {
          attempts++;
          console.error(`Attempt ${attempts} failed:`, e);
          
          if (attempts >= maxAttempts) {
            throw new Error(`Failed after ${maxAttempts} attempts: ${e.message}`);
          }
          
          // Reset session for retry
          reset();
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setTestData(parsed);
      setScreen('preview');
    } catch (e: any) {
      console.error('Generation error:', e);
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }

  async function fetchActiveTabContent(): Promise<any> {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs || !tabs.length) {
      throw new Error('No active tab found');
    }
    const tab = tabs[0];
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id as number },
      func: () => ({ title: document.title, text: document.body.innerText, favicon: (document.querySelector('link[rel~="icon"]') as HTMLLinkElement)?.href || '' })
    });
    if (!results || !results[0] || !results[0].result) {
      throw new Error('Failed to extract page content');
    }
    return results[0].result;
  }

  function generateFallbackMCQs(page: any) {
    const title = page.title || 'Untitled Page';
    const sentences = (page.text || '').split(/[\.\n]\s+/).filter(Boolean);
    const qlist = [];

    const count = Math.max(3, Math.min(30, numQuestions));

    for (let i = 0; i < Math.min(count, sentences.length); i++) {
      const s = sentences[i].slice(0, 80);
      if (testType === 'mcq') {
        qlist.push({
          question: `Question ${i + 1}: What does this statement refer to?`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          answer_index: 0
        });
      } else if (testType === 'true_false') {
        qlist.push({
          question: `True or False: ${s}?`,
          answer: true
        });
      } else {
        qlist.push({
          question: `Fill in the blank: ${s} ____`,
          answer: 'answer'
        });
      }
    }

    while (qlist.length < count) {
      if (testType === 'mcq') {
        qlist.push({
          question: `Question ${qlist.length + 1}: Select the correct answer`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          answer_index: 0
        });
      } else if (testType === 'true_false') {
        qlist.push({
          question: `True or False: Placeholder statement ${qlist.length + 1}`,
          answer: true
        });
      } else {
        qlist.push({
          question: `Fill in the blank: Placeholder sentence ${qlist.length + 1} ____`,
          answer: 'answer'
        });
      }
    }
    return { source_title: title, questions: qlist };
  }

  async function loadSavedState() {
    try {
      const result = await chrome.storage.local.get([
        'inputPrompt',
        'temperature',
        'topK',
        'testData',
        'error'
      ]);

      if (result.inputPrompt) setInputPrompt(result.inputPrompt);
      if (result.temperature) setTemperature(result.temperature);
      if (result.topK) setTopK(result.topK);
      if (result.testData) setTestData(result.testData);
      if (result.error) setError(result.error);
    } catch (e: any) {
      console.error('Failed to load saved state:', e);
    }
  }

  async function saveState() {
    try {
      await chrome.storage.local.set({
        inputPrompt,
        temperature,
        topK,
        testData,
        error
      });
    } catch (e: any) {
      console.error('Failed to save state:', e);
    }
  }

  function handleReset() {
    setError('');
    setLoading(false);
    setInputPrompt('');
    setTestData(null);
    setScreen('home');
    setUserAnswers({});
    setCurrentQuestion(0);
    setTimeLeft(600);
    setTestStarted(false);
    reset();
    chrome.storage.local.clear();
  }

  function handleStartTest() {
    setScreen('test');
    setTestStarted(true);
    setCurrentQuestion(0);
    setUserAnswers({});
  }

  function handleAnswerSelect(questionIndex: number, optionIndex: number) {
    setUserAnswers((prev: any) => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  }

  function handleSubmitTest() {
    setTestStarted(false);
    setScreen('results');
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function calculateScore() {
    let correct = 0;
    testData.questions.forEach((q: any, idx: number) => {
      if (userAnswers[idx] === q.answer_index) {
        correct++;
      }
    });
    return correct;
  }

  // Home Screen
  if (screen === 'home') {
    return (
      <div className="w-full h-screen bg-[#1A1A1A] flex flex-col justify-between">
        <div className='flex justify-between items-center px-4 pt-4 pb-1'>
          <button className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'>
            <Clock className='w-5 h-5 text-gray-400' />
          </button>
          <h1 className="text-[16px] text-neutral-200">
            Manifes<span className='font-bold italic text-yellow-400'>T</span><span className='text-yellow-400'>est</span>
          </h1>
          <button className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'>
            <Settings className='w-5 h-5 text-gray-400' />
          </button>
        </div>

        <div className='pt-1 px-7'>
          <h1 className="text-[16px] text-neutral-300">
            Open a File or Webpage to Create a Test
          </h1>
          <p className="text-xs font-light text-neutral-500">
            {error || 'Click the search button to generate a test from the current page.'}
          </p>
        </div>
        
        {!loading && (
          <div className='flex-1 flex items-center justify-center p-2 overflow-hidden'>
            <div className='border-2 border-dashed border-[#3A3A3A] rounded-2xl p-8 w-1/2 max-w-md flex flex-col items-center gap-4'>
              <FilePlus className='w-14 h-14 text-yellow-500' strokeWidth={1.5} />
              <div className='text-center space-y-1'>
                <p className='text-xl text-gray-300 font-medium'>Drag 'n' Drop</p>
                <p className='text-[12px] text-gray-500'>.pdf, .doc and .docx</p>
              </div>
            </div>
          </div>
        )}

        <div className='w-full flex justify-center pb-4 px-4'>
          <div className='w-full max-w-2xl'>
            <div className='rounded-xl px-2 py-2 bg-[#202020] border border-[#3d3d3d] flex flex-col gap-1'>
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder='Type a topic or add a link'
                className='bg-transparent w-full outline-none text-neutral-300 placeholder-neutral-500 py-1 pb-2 text-[12px]'
              />
              <div className='flex items-center gap-2 pt-1'>
                <button onClick={() => setTestType('mcq')} className={(testType==='mcq' ? 'bg-yellow-500 text-black' : 'bg-[#2A2A2A] text-gray-300 hover:bg-[#333]') + ' px-3 py-1.5 rounded-lg text-[12px]'}>Choose</button>
                <button onClick={() => setTestType('true_false')} className={(testType==='true_false' ? 'bg-yellow-500 text-black' : 'bg-[#2A2A2A] text-gray-300 hover:bg-[#333]') + ' px-3 py-1.5 rounded-lg text-[12px]'}>True/ False</button>
                <button onClick={() => setTestType('fill_in')} className={(testType==='fill_in' ? 'bg-yellow-500 text-black' : 'bg-[#2A2A2A] text-gray-300 hover:bg-[#333]') + ' px-3 py-1.5 rounded-lg text-[12px]'}>Fill In</button>
              </div>
              <div className='flex items-center gap-3 px-1'>
                <span className='text-[11px] text-gray-400'>Questions</span>
                <input type='range' min={3} max={30} value={numQuestions} onChange={(e)=> setNumQuestions(parseInt(e.target.value,10))} className='w-full accent-yellow-500'/>
                <span className='text-[12px] text-gray-300 w-8 text-right'>{numQuestions}</span>
              </div>
              <div className='flex items-center gap-2'>
                <button
                  className='w-6 h-6 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors disabled:opacity-50'
                  disabled={!inputPrompt.trim() || loading}
                >
                  <Plus className='w-5 h-5 text-yellow-500' strokeWidth={2.5} />
                </button>
                <button
                  className='w-6 h-6 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors disabled:opacity-50'
                  onClick={handleGenerateMCQs}
                  disabled={loading}
                >
                  <Search className='w-4 h-4 text-yellow-500' strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
        {loading && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/60'>
            <div className='w-[400px] h-[500px] rounded-3xl relative' style={{ boxShadow: '0 0 40px rgba(255, 224, 102, 0.25), inset 0 0 50px rgba(118, 70, 255, 0.15)' }}>
              <div className='absolute inset-0 rounded-3xl bg-gradient-to-br from-[#0c0c14] via-[#151526] to-[#0c0c14] border border-[#2b2b46]' />
              <div className='relative z-10 flex items-center justify-between px-4 pt-3'>
                <button onClick={() => { setLoading(false); reset(); }} className='flex items-center gap-2 group'>
                  {activeTabInfo?.favicon ? (
                    <img src={activeTabInfo.favicon} alt='site' className='w-6 h-6 rounded-sm border border-white/10' />
                  ) : (
                    <div className='w-6 h-6 rounded-sm bg-white/10' />
                  )}
                  <span className='text-[12px] text-gray-300 line-clamp-1 group-hover:underline'>{activeTabInfo?.title || 'Current page'}</span>
                </button>
                <button onClick={() => { setLoading(false); reset(); }} className='w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10'>
                  <X className='w-4 h-4 text-gray-300' />
                </button>
              </div>
              <div className='relative z-10 px-4 mt-3'>
                <div className='h-28 overflow-hidden rounded-xl bg-black/30 border border-white/5 p-3'>
                  <div className='space-y-2 animate-pulse'>
                    <div className='h-3 bg-white/10 rounded' />
                    <div className='h-3 bg-white/10 rounded w-4/5' />
                    <div className='h-3 bg-white/10 rounded w-3/5' />
                    <div className='h-3 bg-white/10 rounded w-2/3' />
                  </div>
                </div>
              </div>
              <div className='relative z-10 flex items-center justify-center h-[260px]'>
                <div className='w-32 h-32 rounded-full border-4 border-transparent border-t-yellow-400 border-r-yellow-400 animate-spin' />
              </div>
              <div className='absolute bottom-4 left-0 right-0 px-4'>
                <div className='flex items-center justify-between'>
                  <button onClick={() => { setLoading(false); setScreen('home'); }} className='px-4 py-3 rounded-xl bg-[#1f1f2e] text-gray-300 text-sm hover:bg-[#2a2a3d]'>Go Home</button>
                  <div className='flex items-center gap-3'>
                    <button className='px-4 py-2 rounded-xl bg-[#1f1f2e] text-gray-300 text-[12px]' disabled>
                      {testType === 'mcq' ? 'Choose' : testType === 'true_false' ? 'True/ False' : 'Fill In'}
                    </button>
                    <div className='w-12 h-20 rounded-2xl bg-[#101018] border border-white/10 flex items-center justify-center text-yellow-400 font-bold'>
                      {numQuestions}
                    </div>
                  </div>
                  <button onClick={() => { setLoading(false); reset(); }} className='px-6 py-3 rounded-2xl bg-yellow-500 text-black font-bold hover:bg-yellow-400'>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Preview Screen
  if (screen === 'preview' && testData) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f1419] flex flex-col">
        <div className='flex justify-between items-center px-6 pt-6 pb-4'>
          <button 
            onClick={() => setScreen('home')}
            className='w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors'
          >
            <ArrowLeft className='w-5 h-5 text-gray-300' />
          </button>
          <h1 className="text-sm text-gray-300">
            ManifesTest - {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h1>
          <button className='w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors'>
            <Settings className='w-5 h-5 text-gray-300' />
          </button>
        </div>

        <div className='flex-1 flex flex-col items-center justify-between px-8 pb-8'>
          <div className='text-center mt-8'>
            <h1 className="text-4xl font-bold text-white mb-4">
              {testData.source_title?.split('|')[0]?.trim() || 'Test'}
            </h1>
            <p className="text-gray-400 text-sm">
              {testData.source_title}
            </p>
          </div>

          <div className='w-full max-w-2xl space-y-6'>
            <div className='flex justify-between text-gray-300'>
              <span>Time: 10 min</span>
              <span>Max. Marks: {testData.questions.length}</span>
            </div>

            <div className='text-gray-300 space-y-3'>
              <p className='italic'>Instructions:</p>
              <ol className='list-decimal list-inside space-y-2 text-sm'>
                <li>All questions are compulsory.</li>
                <li>You will have MCQs, Truth or False and Fill in the Blanks as part of the test.</li>
                <li>Click the yellow button on the bottom right to fullscreen.</li>
              </ol>
            </div>

            <div className='border-2 border-blue-500/30 rounded-3xl p-8 bg-black/20 relative'>
              <div className='flex items-center justify-center gap-6'>
                <button 
                  className='px-8 py-3 bg-white/90 hover:bg-white text-black font-medium rounded-xl transition-colors'
                >
                  Save
                </button>
                <button 
                  onClick={handleStartTest}
                  className='px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors'
                >
                  Start Test
                </button>
              </div>
              
              <div className='absolute bottom-6 left-8 text-5xl font-bold text-white'>
                10:00
              </div>
              
              <button className='absolute bottom-6 right-6 w-16 h-16 bg-yellow-500 hover:bg-yellow-400 rounded-2xl flex items-center justify-center transition-colors'>
                <Maximize2 className='w-7 h-7 text-black' />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Test Screen
  if (screen === 'test' && testData) {
    const question = testData.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / testData.questions.length) * 100;

    return (
      <div className="w-full h-screen bg-[#1A1A1A] flex flex-col">
        <div className='flex justify-between items-center px-6 py-4 border-b border-gray-800'>
          <div className='flex items-center gap-4'>
            <span className='text-gray-400 text-sm'>Question {currentQuestion + 1}/{testData.questions.length}</span>
            <div className='w-40 h-2 bg-gray-800 rounded-full overflow-hidden'>
              <div 
                className='h-full bg-yellow-500 transition-all duration-300'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className='text-yellow-500 font-bold text-lg'>{formatTime(timeLeft)}</div>
        </div>

        <div className='flex-1 flex flex-col items-center justify-center px-8'>
          <div className='w-full max-w-3xl space-y-8'>
            <h2 className='text-2xl text-white font-medium leading-relaxed'>
              {question.question}
            </h2>

            <div className='space-y-3'>
              {question.options.map((option: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleAnswerSelect(currentQuestion, idx)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    userAnswers[currentQuestion] === idx
                      ? 'bg-yellow-500 text-black font-medium'
                      : 'bg-[#202020] text-gray-300 hover:bg-[#2A2A2A]'
                  }`}
                >
                  <span className='font-bold mr-3'>{String.fromCharCode(65 + idx)}.</span>
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className='flex justify-between items-center px-8 py-6 border-t border-gray-800'>
          <button
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            className='px-6 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors'
          >
            Previous
          </button>
          
          {currentQuestion === testData.questions.length - 1 ? (
            <button
              onClick={handleSubmitTest}
              className='px-8 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors'
            >
              Submit Test
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestion(prev => Math.min(testData.questions.length - 1, prev + 1))}
              className='px-6 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors'
            >
              Next
            </button>
          )}
        </div>
      </div>
    );
  }

  // Results Screen
  if (screen === 'results' && testData) {
    const score = calculateScore();
    const percentage = (score / testData.questions.length) * 100;

    return (
      <div className="w-full h-screen bg-[#1A1A1A] flex flex-col items-center justify-center px-8">
        <div className='w-full max-w-2xl text-center space-y-8'>
          <h1 className='text-4xl font-bold text-white'>Test Completed!</h1>
          
          <div className='bg-[#202020] rounded-3xl p-12 space-y-6'>
            <div className='text-6xl font-bold text-yellow-500'>
              {score}/{testData.questions.length}
            </div>
            <div className='text-2xl text-gray-300'>
              {percentage.toFixed(0)}% Correct
            </div>
            
            <div className='pt-6 space-y-3'>
            {testData.questions.map((q: any, idx: number) => (
                <div key={idx} className='flex items-center justify-between text-sm'>
                  <span className='text-gray-400'>Question {idx + 1}</span>
                  <span className={userAnswers[idx] === q.answer_index ? 'text-green-500' : 'text-red-500'}>
                    {userAnswers[idx] === q.answer_index ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleReset}
            className='px-8 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors'
          >
            Create New Test
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;