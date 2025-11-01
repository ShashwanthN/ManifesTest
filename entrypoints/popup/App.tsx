import { useState, useEffect } from 'react';
import { Clock, Settings, Plus, Search, FilePlus, ArrowLeft, Maximize2, X, Home, History, Save, Archive, ArchiveRestore, Trash2, RotateCcw, Eye } from 'lucide-react';
import TestTypeButtons, { TestType } from './components/TestTypeButtons';
import VerticalSlider from './components/VerticalSlider';
import { buildMultiTypePrompt, generateFallbackQuestions, Question } from './utils/testGeneration';

interface SavedTest {
  id: string;
  testData: any;
  savedAt: number;
  title: string;
  timeLeft?: number;
  currentQuestion?: number;
  userAnswers?: any;
  isCompleted?: boolean;
  isArchived?: boolean;
  completedAt?: number;
  score?: number;
  percentage?: number;
}

function App() {
  const [screen, setScreen] = useState('home'); // 'home', 'preview', 'test', 'results', 'history'
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
  const [selectedTypes, setSelectedTypes] = useState<Set<TestType>>(new Set(['mcq']));
  const [numQuestions, setNumQuestions] = useState(10);
  const [activeTabInfo, setActiveTabInfo] = useState<any>(null);
  const [savedTests, setSavedTests] = useState<SavedTest[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [llmResponse, setLlmResponse] = useState('');
  const [llmLoading, setLlmLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<'active' | 'completed' | 'archived'>('active');

  useEffect(() => {
    const initialize = async () => {
      // Check if generation completed while popup was closed
      const savedState = await chrome.storage.local.get(['loading', 'testData', 'screen', 'activeTabInfo', 'selectedTypes', 'numQuestions', 'generationCompleted']);
      
      // If generation completed in background, show preview
      if (savedState.generationCompleted && savedState.testData) {
        setTestData(savedState.testData);
        setScreen('preview');
        setLoading(false);
        await chrome.storage.local.remove(['loading', 'generationCompleted']);
        await loadSavedTests();
        return;
      }
      
      // If we were loading, continue generation (it may still be in progress via background)
      if (savedState.loading && savedState.activeTabInfo && savedState.selectedTypes && savedState.numQuestions && !savedState.testData) {
        setLoading(true);
        setActiveTabInfo(savedState.activeTabInfo);
        setSelectedTypes(new Set(savedState.selectedTypes));
        setNumQuestions(savedState.numQuestions);
        await loadSavedTests();
        // Check if still loading after a moment, then restart if needed
        setTimeout(async () => {
          const check = await chrome.storage.local.get(['testData', 'generationCompleted']);
          if (!check.testData && !check.generationCompleted) {
            handleGenerateMCQs();
          }
        }, 500);
        return;
      }
      
      // Don't reset if we already have test data
      if (testData) {
        await loadSavedTests();
        return;
      }
      
      await loadSavedTests();
      await initDefaults();
      await loadSavedState();
    };
    initialize();
  }, []);

  useEffect(() => {
    saveState();
  }, [inputPrompt, temperature, topK, testData, error, loading, screen, activeTabInfo, selectedTypes, numQuestions]);

  useEffect(() => {
    saveTestState();
  }, [screen, currentQuestion, userAnswers, timeLeft, testStarted]);

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
    
    // Mark generation as in progress
    await chrome.storage.local.set({ 
      loading: true, 
      generationCompleted: false,
      activeTabInfo,
      selectedTypes: Array.from(selectedTypes),
      numQuestions
    });

    // Use setTimeout to allow generation to continue even if popup closes
    const generationPromise = (async () => {
      try {
        if (selectedTypes.size === 0) {
          throw new Error('Please select at least one test type');
        }

        if (!chrome.scripting) {
          throw new Error('chrome.scripting API not available');
        }

        const page = await fetchActiveTabContent();
        setActiveTabInfo({ title: page.title, favicon: page.favicon });
        const pageText = `${page.title}\n\n${page.text}`.slice(0, 200000);

        const count = Math.max(3, Math.min(30, numQuestions));
        const generationPrompt = buildMultiTypePrompt(selectedTypes, count, pageText);

        if (!('LanguageModel' in self)) {
          const fallback = generateFallbackQuestions(page, selectedTypes, count);
          setTestData(fallback);
          setScreen('preview');
          await chrome.storage.local.set({ 
            testData: fallback, 
            loading: false, 
            generationCompleted: true,
            screen: 'preview'
          });
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

        while (attempts < maxAttempts) {
          try {
            result = await runPrompt(generationPrompt, params);
            parsed = extractJSON(result);
            
            if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
              throw new Error('Invalid question format');
            }
            
            break;
          } catch (e: any) {
            attempts++;
            if (attempts >= maxAttempts) {
              throw new Error(`Failed after ${maxAttempts} attempts: ${e.message}`);
            }
            reset();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Save completion to storage (works even if popup closed)
        await chrome.storage.local.set({ 
          testData: parsed, 
          loading: false, 
          generationCompleted: true,
          screen: 'preview'
        });
        
        setTestData(parsed);
        setScreen('preview');
      } catch (e: any) {
        console.error('Generation error:', e);
        setError(e.toString());
        await chrome.storage.local.set({ 
          loading: false, 
          generationCompleted: false,
          error: e.toString()
        });
      } finally {
        setLoading(false);
      }
    })();
    
    // Don't await - let it run in background
    generationPromise.catch(err => {
      console.error('Background generation error:', err);
    });
  }

  async function handleLLMQuestion() {
    if (!inputPrompt.trim()) return;
    
    setLlmLoading(true);
    setError('');
    setLlmResponse('');
    
    try {
      if (!('LanguageModel' in self)) {
        setError('Language Model not available');
        setLlmLoading(false);
        return;
      }

      const params = {
        initialPrompts: [
          { role: 'system', content: 'You are a helpful assistant. Provide clear, concise answers.' }
        ],
        temperature: temperature,
        topK: topK
      };

      const result = await runPrompt(inputPrompt, params);
      setLlmResponse(result);
    } catch (e: any) {
      console.error('LLM question error:', e);
      setError(e.toString());
    } finally {
      setLlmLoading(false);
    }
  }
  
  function isTestGenerationRequest(prompt: string): boolean {
    const lower = prompt.toLowerCase().trim();
    // More specific keywords that indicate test generation
    return lower.startsWith('generate') || 
           lower.startsWith('create') ||
           lower.includes('generate test') ||
           lower.includes('create test') ||
           lower.includes('make test') ||
           (lower.includes('test') && (lower.includes('from') || lower.includes('about')));
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

  function handleToggleTestType(type: TestType) {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  }

  async function loadSavedState() {
    try {
      // Don't load if we're currently loading or have active state
      if (loading) {
        return;
      }
      
      const result = await chrome.storage.local.get([
        'inputPrompt',
        'temperature',
        'topK',
        'error',
        'loading'
      ]);

      // Only restore state if we're not in the middle of generation
      if (!result.loading) {
        if (result.inputPrompt) setInputPrompt(result.inputPrompt);
        if (result.temperature) setTemperature(result.temperature);
        if (result.topK) setTopK(result.topK);
        if (result.error) setError(result.error);
      }
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
        error,
        loading,
        screen,
        activeTabInfo,
        selectedTypes: Array.from(selectedTypes),
        numQuestions
      });
    } catch (e: any) {
      console.error('Failed to save state:', e);
    }
  }

  async function saveTestState() {
    try {
      if (screen === 'test' && testData) {
        await chrome.storage.local.set({
          testState: {
            currentQuestion,
            userAnswers,
            timeLeft,
            testStarted,
            screen,
            testData
          }
        });
      }
    } catch (e: any) {
      console.error('Failed to save test state:', e);
    }
  }

  async function loadTestState() {
    try {
      const result = await chrome.storage.local.get(['testState']);
      if (result.testState && result.testState.testData) {
        setCurrentQuestion(result.testState.currentQuestion || 0);
        setUserAnswers(result.testState.userAnswers || {});
        setTimeLeft(result.testState.timeLeft || 600);
        setTestStarted(result.testState.testStarted || false);
        setTestData(result.testState.testData);
        setScreen(result.testState.screen || 'test');
        return true;
      }
    } catch (e: any) {
      console.error('Failed to load test state:', e);
    }
    return false;
  }

  async function loadSavedTests() {
    try {
      const result = await chrome.storage.local.get(['savedTests']);
      if (result.savedTests) {
        setSavedTests(result.savedTests);
      }
    } catch (e: any) {
      console.error('Failed to load saved tests:', e);
    }
  }

  async function saveTest() {
    try {
      if (!testData || isSaving) return;
      
      setIsSaving(true);
      
      const title = testData.source_title?.split('|')[0]?.trim() || `Test ${new Date().toLocaleDateString()}`;
      
      // Get fresh saved tests to avoid stale state
      const result = await chrome.storage.local.get(['savedTests']);
      const currentSavedTests = result.savedTests || [];
      
      // Check if a test with the same title already exists
      const existingIndex = currentSavedTests.findIndex((t: SavedTest) => t.title === title);
      
      const savedTest: SavedTest = {
        id: existingIndex >= 0 ? currentSavedTests[existingIndex].id : Date.now().toString(),
        testData,
        savedAt: Date.now(),
        title,
        timeLeft,
        currentQuestion,
        userAnswers
      };

      let updated: SavedTest[];
      if (existingIndex >= 0) {
        // Update existing test
        updated = [...currentSavedTests];
        updated[existingIndex] = savedTest;
      } else {
        // Add new test
        updated = [...currentSavedTests, savedTest];
      }
      
      setSavedTests(updated);
      await chrome.storage.local.set({ savedTests: updated });
    } catch (e: any) {
      console.error('Failed to save test:', e);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSavedTest(id: string) {
    try {
      const updated = savedTests.filter(t => t.id !== id);
      setSavedTests(updated);
      await chrome.storage.local.set({ savedTests: updated });
    } catch (e: any) {
      console.error('Failed to delete saved test:', e);
    }
  }

  async function archiveTest(id: string) {
    try {
      const updated = savedTests.map(t => 
        t.id === id ? { ...t, isArchived: true } : t
      );
      setSavedTests(updated);
      await chrome.storage.local.set({ savedTests: updated });
    } catch (e: any) {
      console.error('Failed to archive test:', e);
    }
  }

  async function unarchiveTest(id: string) {
    try {
      const updated = savedTests.map(t => 
        t.id === id ? { ...t, isArchived: false } : t
      );
      setSavedTests(updated);
      await chrome.storage.local.set({ savedTests: updated });
    } catch (e: any) {
      console.error('Failed to unarchive test:', e);
    }
  }

  function handleRetakeTest(savedTest: SavedTest) {
    // Reset answers and start fresh
    setTestData(savedTest.testData);
    setCurrentQuestion(0);
    setUserAnswers({});
    setTimeLeft(600);
    setTestStarted(false);
    setScreen('test');
    setShowHistory(false);
  }

  function handleReviewTest(savedTest: SavedTest) {
    // Load test with answers for review (read-only mode)
    setTestData(savedTest.testData);
    setCurrentQuestion(0);
    setUserAnswers(savedTest.userAnswers || {});
    setTimeLeft(savedTest.timeLeft || 600);
    setTestStarted(false);
    setScreen('test');
    setShowHistory(false);
  }

  async function loadSavedTest(savedTest: SavedTest) {
    try {
      setTestData(savedTest.testData);
      setCurrentQuestion(savedTest.currentQuestion || 0);
      setUserAnswers(savedTest.userAnswers || {});
      setTimeLeft(savedTest.timeLeft || 600);
      setScreen('test');
      setShowHistory(false);
    } catch (e: any) {
      console.error('Failed to load saved test:', e);
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

  async function handleStartTest() {
    // Always start from the beginning for a new test
    setCurrentQuestion(0);
    setUserAnswers({});
    setTimeLeft(600); // Reset timer to 10 minutes
    setScreen('test');
    setTestStarted(true);
  }

  function handleAnswerSelect(questionIndex: number, value: any) {
    setUserAnswers((prev: any) => ({
      ...prev,
      [questionIndex]: value
    }));
  }

  async function handleSubmitTest() {
    setTestStarted(false);
    
    // Save as completed test
    if (testData) {
      const score = calculateScore();
      const percentage = (score / testData.questions.length) * 100;
      const title = testData.source_title?.split('|')[0]?.trim() || `Test ${new Date().toLocaleDateString()}`;
      
      const result = await chrome.storage.local.get(['savedTests']);
      const currentSavedTests = result.savedTests || [];
      
      // Check if already exists as active test, if so remove it first
      const existingIndex = currentSavedTests.findIndex((t: SavedTest) => t.id === testData.id && !t.isCompleted);
      
      const completedTest: SavedTest = {
        id: testData.id || Date.now().toString(),
        testData,
        savedAt: Date.now(),
        completedAt: Date.now(),
        title,
        userAnswers,
        timeLeft,
        isCompleted: true,
        isArchived: false,
        score,
        percentage
      };
      
      let updated: SavedTest[];
      if (existingIndex >= 0) {
        updated = [...currentSavedTests];
        updated[existingIndex] = completedTest;
      } else {
        updated = [...currentSavedTests, completedTest];
      }
      
      setSavedTests(updated);
      await chrome.storage.local.set({ savedTests: updated });
    }
    
    setScreen('results');
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function calculateScore() {
    let correct = 0;
    testData.questions.forEach((q: Question, idx: number) => {
      if (q.type === 'mcq' && userAnswers[idx] === q.answer_index) {
        correct++;
      } else if (q.type === 'true_false' && userAnswers[idx] === q.answer) {
        correct++;
      } else if (q.type === 'fill_in' && userAnswers[idx]?.toLowerCase().trim() === (q.answer as string)?.toLowerCase().trim()) {
        correct++;
      }
    });
    return correct;
  }

  // Home Screen
  if (screen === 'home') {
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
              onClick={() => setShowHistory(!showHistory)}
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
                  onToggleType={handleToggleTestType}
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
                    onChange={setNumQuestions}
                  />
                 
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              disabled={loading || selectedTypes.size === 0}
              onClick={handleGenerateMCQs}
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
                onClick={() => { setLoading(false); reset(); }}
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
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && !llmLoading && inputPrompt.trim()) {
                      if (isTestGenerationRequest(inputPrompt)) {
                        handleGenerateMCQs();
                      } else {
                        handleLLMQuestion();
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
                      handleGenerateMCQs();
                    } else {
                      handleLLMQuestion();
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

        {/* History Modal */}
        {showHistory && (
          <div className='fixed inset-0 flex items-center justify-center bg-black/80 z-[100]' onClick={() => setShowHistory(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className='bg-[#202020] border border-[#3d3d3d] rounded-2xl p-6 w-[90%] max-w-md overflow-hidden' onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div className='flex items-center justify-between mb-4 sticky top-0 bg-[#202020] z-10 pb-2'>
                <h2 className='text-xl text-white font-bold'>Test History</h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className='w-8 h-8 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors'
                >
                  <X className='w-5 h-5 text-gray-400' />
                </button>
              </div>
              
              {/* Tabs */}
              <div className='flex gap-2 mb-4 border-b border-[#3d3d3d]'>
                <button
                  onClick={() => setHistoryTab('active')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    historyTab === 'active' 
                      ? 'text-yellow-400 border-b-2 border-yellow-400' 
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Active ({savedTests.filter(t => !t.isCompleted && !t.isArchived).length})
                </button>
                <button
                  onClick={() => setHistoryTab('completed')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    historyTab === 'completed' 
                      ? 'text-yellow-400 border-b-2 border-yellow-400' 
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Completed ({savedTests.filter(t => t.isCompleted && !t.isArchived).length})
                </button>
                <button
                  onClick={() => setHistoryTab('archived')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    historyTab === 'archived' 
                      ? 'text-yellow-400 border-b-2 border-yellow-400' 
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Archived ({savedTests.filter(t => t.isArchived).length})
                </button>
              </div>
              
              <div className='overflow-y-auto flex-1' style={{ maxHeight: 'calc(85vh - 180px)' }}>
                {(() => {
                  const filteredTests = savedTests.filter(t => {
                    if (historyTab === 'active') return !t.isCompleted && !t.isArchived;
                    if (historyTab === 'completed') return t.isCompleted && !t.isArchived;
                    if (historyTab === 'archived') return t.isArchived;
                    return false;
                  });

                  if (filteredTests.length === 0) {
                    return (
                      <div className='text-center py-8 text-gray-400'>
                        <History className='w-12 h-12 mx-auto mb-3 opacity-50' />
                        <p>
                          {historyTab === 'active' && 'No active tests'}
                          {historyTab === 'completed' && 'No completed tests'}
                          {historyTab === 'archived' && 'No archived tests'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className='space-y-3'>
                      {filteredTests.map((test) => (
                        <div 
                          key={test.id} 
                          className='bg-[#1A1A1A] border border-[#3d3d3d] rounded-xl p-4 hover:bg-[#252525] transition-colors'
                        >
                          <div className='flex items-start justify-between mb-2'>
                            <div className='flex-1'>
                              <h3 className='text-white font-medium mb-1'>{test.title}</h3>
                              <p className='text-xs text-gray-400'>
                                {test.isCompleted && test.completedAt 
                                  ? `Completed: ${new Date(test.completedAt).toLocaleString()}`
                                  : `Saved: ${new Date(test.savedAt).toLocaleString()}`
                                }
                              </p>
                              {test.isCompleted && test.score !== undefined && (
                                <p className='text-xs text-yellow-400 mt-1'>
                                  Score: {test.score}/{test.testData?.questions?.length || 0} ({test.percentage?.toFixed(0) || 0}%)
                                </p>
                              )}
                              {!test.isCompleted && test.currentQuestion !== undefined && (
                                <p className='text-xs text-yellow-400 mt-1'>
                                  Progress: {test.currentQuestion + 1}/{test.testData?.questions?.length || 0} questions
                                </p>
                              )}
                            </div>
                            <div className='flex gap-1'>
                              {historyTab === 'archived' ? (
                                <button
                                  onClick={() => unarchiveTest(test.id)}
                                  className='w-7 h-7 flex items-center justify-center hover:bg-blue-500/20 rounded transition-colors'
                                  title='Unarchive'
                                >
                                  <ArchiveRestore className='w-4 h-4 text-blue-400' />
                                </button>
                              ) : (
                                <button
                                  onClick={() => archiveTest(test.id)}
                                  className='w-7 h-7 flex items-center justify-center hover:bg-gray-500/20 rounded transition-colors'
                                  title='Archive'
                                >
                                  <Archive className='w-4 h-4 text-gray-400' />
                                </button>
                              )}
                              <button
                                onClick={() => deleteSavedTest(test.id)}
                                className='w-7 h-7 flex items-center justify-center hover:bg-red-500/20 rounded transition-colors'
                                title='Delete'
                              >
                                <Trash2 className='w-4 h-4 text-red-400' />
                              </button>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className='flex gap-2 mt-3'>
                            {test.isCompleted ? (
                              <>
                                <button
                                  onClick={() => handleReviewTest(test)}
                                  className='flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2'
                                >
                                  <Eye className='w-4 h-4' />
                                  Review
                                </button>
                                <button
                                  onClick={() => handleRetakeTest(test)}
                                  className='flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2'
                                >
                                  <RotateCcw className='w-4 h-4' />
                                  Retake
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  loadSavedTest(test);
                                  setShowHistory(false);
                                }}
                                className='w-full px-4 py-2 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 transition-colors text-sm'
                              >
                                Continue Test
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/60 z-40'>
            <div className='w-[400px] h-[500px] rounded-3xl relative' style={{ boxShadow: '0 0 40px rgba(255, 224, 102, 0.25), inset 0 0 50px rgba(118, 70, 255, 0.15)' }}>
              <div className='absolute inset-0 rounded-3xl bg-linear-to-br from-[#0c0c14] via-[#151526] to-[#0c0c14] border border-[#2b2b46]' />
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
                <div className='text-gray-400 text-sm'>Generating test questions...</div>
              </div>
              <div className='absolute bottom-4 left-0 right-0 px-4'>
                <div className='flex items-center justify-between'>
                  <button onClick={() => { setLoading(false); setScreen('home'); }} className='px-4 py-3 rounded-xl bg-[#1f1f2e] text-gray-300 text-sm hover:bg-[#2a2a3d]'>Go Home</button>
                  <div className='flex items-center gap-3'>
                    <div className='flex flex-col gap-1'>
                      {Array.from(selectedTypes).map(type => (
                        <button key={type} className='px-4 py-2 rounded-xl bg-[#1f1f2e] text-gray-300 text-[12px]' disabled>
                          {type === 'mcq' ? 'Choose' : type === 'true_false' ? 'True/ False' : 'Fill In'}
                        </button>
                      ))}
                    </div>
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
      <div className="w-full h-full bg-[#1A1A1A] flex flex-col relative" style={{ height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <div className='flex justify-between items-center px-4 pt-3 pb-2'>
          <div className='flex items-center gap-2'>
            <button 
              onClick={() => setScreen('home')}
              className='w-9 h-9 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'
            >
              <Home className='w-4 h-4 text-gray-400' />
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
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
                  onClick={saveTest}
                  disabled={isSaving}
                  className='px-6 py-2 bg-white hover:bg-gray-100 text-black font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 text-sm'
                >
                  <Save className='w-3.5 h-3.5' />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button 
                  onClick={handleStartTest}
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

        {/* History Modal */}
        {showHistory && (
          <div className='fixed inset-0 flex items-center justify-center bg-black/80 z-[100]' onClick={() => setShowHistory(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className='bg-[#202020] border border-[#3d3d3d] rounded-2xl p-6 w-[90%] max-w-md overflow-hidden' onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div className='flex items-center justify-between mb-4 sticky top-0 bg-[#202020] z-10 pb-2'>
                <h2 className='text-xl text-white font-bold'>Test History</h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className='w-8 h-8 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors'
                >
                  <X className='w-5 h-5 text-gray-400' />
                </button>
              </div>
              
              {/* Tabs */}
              <div className='flex gap-2 mb-4 border-b border-[#3d3d3d]'>
                <button
                  onClick={() => setHistoryTab('active')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    historyTab === 'active' 
                      ? 'text-yellow-400 border-b-2 border-yellow-400' 
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Active ({savedTests.filter(t => !t.isCompleted && !t.isArchived).length})
                </button>
                <button
                  onClick={() => setHistoryTab('completed')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    historyTab === 'completed' 
                      ? 'text-yellow-400 border-b-2 border-yellow-400' 
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Completed ({savedTests.filter(t => t.isCompleted && !t.isArchived).length})
                </button>
                <button
                  onClick={() => setHistoryTab('archived')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    historyTab === 'archived' 
                      ? 'text-yellow-400 border-b-2 border-yellow-400' 
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Archived ({savedTests.filter(t => t.isArchived).length})
                </button>
              </div>
              
              <div className='overflow-y-auto flex-1' style={{ maxHeight: 'calc(85vh - 180px)' }}>
                {(() => {
                  const filteredTests = savedTests.filter(t => {
                    if (historyTab === 'active') return !t.isCompleted && !t.isArchived;
                    if (historyTab === 'completed') return t.isCompleted && !t.isArchived;
                    if (historyTab === 'archived') return t.isArchived;
                    return false;
                  });

                  if (filteredTests.length === 0) {
                    return (
                      <div className='text-center py-8 text-gray-400'>
                        <History className='w-12 h-12 mx-auto mb-3 opacity-50' />
                        <p>
                          {historyTab === 'active' && 'No active tests'}
                          {historyTab === 'completed' && 'No completed tests'}
                          {historyTab === 'archived' && 'No archived tests'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className='space-y-3'>
                      {filteredTests.map((test) => (
                        <div 
                          key={test.id} 
                          className='bg-[#1A1A1A] border border-[#3d3d3d] rounded-xl p-4 hover:bg-[#252525] transition-colors'
                        >
                          <div className='flex items-start justify-between mb-2'>
                            <div className='flex-1'>
                              <h3 className='text-white font-medium mb-1'>{test.title}</h3>
                              <p className='text-xs text-gray-400'>
                                {test.isCompleted && test.completedAt 
                                  ? `Completed: ${new Date(test.completedAt).toLocaleString()}`
                                  : `Saved: ${new Date(test.savedAt).toLocaleString()}`
                                }
                              </p>
                              {test.isCompleted && test.score !== undefined && (
                                <p className='text-xs text-yellow-400 mt-1'>
                                  Score: {test.score}/{test.testData?.questions?.length || 0} ({test.percentage?.toFixed(0) || 0}%)
                                </p>
                              )}
                              {!test.isCompleted && test.currentQuestion !== undefined && (
                                <p className='text-xs text-yellow-400 mt-1'>
                                  Progress: {test.currentQuestion + 1}/{test.testData?.questions?.length || 0} questions
                                </p>
                              )}
                            </div>
                            <div className='flex gap-1'>
                              {historyTab === 'archived' ? (
                                <button
                                  onClick={() => unarchiveTest(test.id)}
                                  className='w-7 h-7 flex items-center justify-center hover:bg-blue-500/20 rounded transition-colors'
                                  title='Unarchive'
                                >
                                  <ArchiveRestore className='w-4 h-4 text-blue-400' />
                                </button>
                              ) : (
                                <button
                                  onClick={() => archiveTest(test.id)}
                                  className='w-7 h-7 flex items-center justify-center hover:bg-gray-500/20 rounded transition-colors'
                                  title='Archive'
                                >
                                  <Archive className='w-4 h-4 text-gray-400' />
                                </button>
                              )}
                              <button
                                onClick={() => deleteSavedTest(test.id)}
                                className='w-7 h-7 flex items-center justify-center hover:bg-red-500/20 rounded transition-colors'
                                title='Delete'
                              >
                                <Trash2 className='w-4 h-4 text-red-400' />
                              </button>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className='flex gap-2 mt-3'>
                            {test.isCompleted ? (
                              <>
                                <button
                                  onClick={() => handleReviewTest(test)}
                                  className='flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2'
                                >
                                  <Eye className='w-4 h-4' />
                                  Review
                                </button>
                                <button
                                  onClick={() => handleRetakeTest(test)}
                                  className='flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2'
                                >
                                  <RotateCcw className='w-4 h-4' />
                                  Retake
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  loadSavedTest(test);
                                  setShowHistory(false);
                                }}
                                className='w-full px-4 py-2 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 transition-colors text-sm'
                              >
                                Continue Test
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Test Screen
  if (screen === 'test' && testData) {
    const question: Question = testData.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / testData.questions.length) * 100;
    const answeredQuestions = Object.keys(userAnswers).length;

    return (
      <div className="w-full h-full bg-[#1A1A1A] flex flex-col relative" style={{ height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <div className='border-b border-gray-800'>
          {/* Top Row - Main Info */}
          <div className='flex items-center justify-between px-4 py-2'>
            <button
              onClick={() => setScreen('home')}
              className='w-8 h-8 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors shrink-0'
            >
              <Home className='w-4 h-4 text-gray-400' />
            </button>
            <div className='flex-1 flex flex-col items-center gap-1 mx-3 min-w-0'>
              <div className='text-sm text-gray-300 font-medium whitespace-nowrap'>
                Question {currentQuestion + 1} of {testData.questions.length}
              </div>
              <div className='w-full max-w-[200px] h-1 bg-gray-800 rounded-full overflow-hidden'>
                <div 
                  className='h-full bg-yellow-500 transition-all duration-300'
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className='text-yellow-500 font-bold text-lg whitespace-nowrap shrink-0'>{formatTime(timeLeft)}</div>
          </div>
          
          {/* Bottom Row - Secondary Info */}
          <div className='flex items-center justify-between px-4 py-1.5 border-t border-gray-800/50'>
            <div className='text-xs text-gray-500'>
              {answeredQuestions} of {testData.questions.length} answered
            </div>
            <button
              onClick={saveTest}
              disabled={isSaving}
              className='px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0'
            >
              <Save className='w-3 h-3' />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Question Content */}
        <div className='flex-1 flex flex-col px-6 py-4 overflow-y-auto'>
          <div className='w-full max-w-2xl mx-auto space-y-6'>
            <div className='flex items-start gap-3'>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                userAnswers[currentQuestion] !== undefined 
                  ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50' 
                  : 'bg-gray-700 text-gray-400 border-2 border-gray-600'
              }`}>
                {currentQuestion + 1}
              </div>
              <h2 className='text-lg text-white font-medium leading-relaxed flex-1 pt-1.5'>
                {question.question}
              </h2>
            </div>

            {/* MCQ Question */}
            {question.type === 'mcq' && question.options && (
              <div className='space-y-2.5'>
                {question.options.map((option: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(currentQuestion, idx)}
                    className={`w-full p-3.5 rounded-xl text-left transition-all ${
                      userAnswers[currentQuestion] === idx
                        ? 'bg-yellow-500 text-black font-medium'
                        : 'bg-[#202020] text-gray-300 hover:bg-[#2A2A2A] border border-transparent hover:border-gray-600'
                    }`}
                  >
                    <span className='font-bold mr-3 text-base'>{String.fromCharCode(65 + idx)}.</span>
                    <span className='text-sm'>{option}</span>
                  </button>
                ))}
              </div>
            )}

            {/* True/False Question */}
            {question.type === 'true_false' && (
              <div className='space-y-2.5'>
                <button
                  onClick={() => handleAnswerSelect(currentQuestion, true)}
                  className={`w-full p-3.5 rounded-xl text-left transition-all ${
                    userAnswers[currentQuestion] === true
                      ? 'bg-yellow-500 text-black font-medium'
                      : 'bg-[#202020] text-gray-300 hover:bg-[#2A2A2A] border border-transparent hover:border-gray-600'
                  }`}
                >
                  <span className='text-base font-medium'>True</span>
                </button>
                <button
                  onClick={() => handleAnswerSelect(currentQuestion, false)}
                  className={`w-full p-3.5 rounded-xl text-left transition-all ${
                    userAnswers[currentQuestion] === false
                      ? 'bg-yellow-500 text-black font-medium'
                      : 'bg-[#202020] text-gray-300 hover:bg-[#2A2A2A] border border-transparent hover:border-gray-600'
                  }`}
                >
                  <span className='text-base font-medium'>False</span>
                </button>
              </div>
            )}

            {/* Fill In Question */}
            {question.type === 'fill_in' && (
              <div className='space-y-2.5'>
                <input
                  type="text"
                  value={userAnswers[currentQuestion] || ''}
                  onChange={(e) => handleAnswerSelect(currentQuestion, e.target.value)}
                  placeholder='Type your answer...'
                  className='w-full p-3.5 rounded-xl bg-[#202020] text-white placeholder-gray-500 border border-gray-700 focus:border-yellow-500 focus:outline-none text-sm'
                />
              </div>
            )}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className='flex flex-col gap-3 px-6 py-3 border-t border-gray-800 bg-[#1A1A1A]'>
          <div className='flex justify-between items-center'>
            <button
              onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
              className='px-5 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm'
            >
              <ArrowLeft className='w-4 h-4' />
              Previous
            </button>
            
            <button
              onClick={() => {
                if (currentQuestion === testData.questions.length - 1) {
                  handleSubmitTest();
                } else {
                  setCurrentQuestion(prev => Math.min(testData.questions.length - 1, prev + 1));
                }
              }}
              className='px-5 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2 text-sm'
            >
              {currentQuestion === testData.questions.length - 1 ? 'Submit Test' : 'Next Question'}
              {currentQuestion !== testData.questions.length - 1 && (
                <ArrowLeft className='w-4 h-4 rotate-180' />
              )}
            </button>
          </div>
          
          <div className='flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent'>
            {testData.questions.map((_: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`shrink-0 w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  idx === currentQuestion
                    ? 'bg-yellow-500 text-black'
                    : userAnswers[idx] !== undefined
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Results Screen
  if (screen === 'results' && testData) {
    const score = calculateScore();
    const total = testData.questions.length;
    const percentage = (score / total) * 100;
    const incorrect = total - score;
    
    // Calculate correct/incorrect counts
    const correctQuestions: number[] = [];
    const incorrectQuestions: Array<{index: number; question: Question; userAnswer: any; correctAnswer: any}> = [];
    
    testData.questions.forEach((q: Question, idx: number) => {
      let isCorrect = false;
      if (q.type === 'mcq' && userAnswers[idx] === q.answer_index) {
        isCorrect = true;
      } else if (q.type === 'true_false' && userAnswers[idx] === q.answer) {
        isCorrect = true;
      } else if (q.type === 'fill_in' && userAnswers[idx]?.toLowerCase().trim() === (q.answer as string)?.toLowerCase().trim()) {
        isCorrect = true;
      }
      
      if (isCorrect) {
        correctQuestions.push(idx);
      } else {
        incorrectQuestions.push({
          index: idx,
          question: q,
          userAnswer: userAnswers[idx],
          correctAnswer: q.type === 'mcq' ? q.options?.[q.answer_index || 0] : q.answer
        });
      }
    });

    // Determine performance message and color
    let performanceColor = 'text-yellow-500';
    let performanceMessage = 'Good job!';
    if (percentage >= 90) {
      performanceColor = 'text-green-500';
      performanceMessage = 'Excellent!';
    } else if (percentage >= 70) {
      performanceColor = 'text-yellow-500';
      performanceMessage = 'Well done!';
    } else if (percentage >= 50) {
      performanceColor = 'text-orange-500';
      performanceMessage = 'Keep practicing!';
    } else {
      performanceColor = 'text-red-500';
      performanceMessage = 'Try again!';
    }

    return (
      <div className="w-full h-full bg-[#1A1A1A] flex flex-col relative overflow-y-auto" style={{ height: '100vh' }}>
        {/* Header */}
        <div className='flex justify-between items-center px-6 pt-6 pb-4 border-b border-gray-800'>
          <button
            onClick={() => setScreen('home')}
            className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'
          >
            <Home className='w-5 h-5 text-gray-400' />
          </button>
          <h1 className="text-lg text-white font-bold">
            Test Results
          </h1>
          <div className='w-10' />
        </div>

        {/* Main Content */}
        <div className='flex-1 overflow-y-auto px-6 py-6'>
          <div className='w-full max-w-3xl mx-auto space-y-6'>
            {/* Score Card */}
            <div className='bg-gradient-to-br from-[#202020] to-[#1a1a1a] border border-[#3d3d3d] rounded-3xl p-8 text-center space-y-4'>
              <h2 className='text-2xl font-bold text-white mb-4'>Test Completed!</h2>
              
              {/* Large Score Display */}
              <div className='flex items-center justify-center gap-4 mb-4'>
                <div className={`text-7xl font-bold ${performanceColor}`}>
                  {score}
                </div>
                <div className='text-4xl text-gray-500'>/</div>
                <div className='text-7xl font-bold text-gray-400'>
                  {total}
                </div>
              </div>
              
              {/* Percentage Circle */}
              <div className='flex justify-center mb-4'>
                <div className='relative w-32 h-32'>
                  <svg className='transform -rotate-90 w-32 h-32'>
                    <circle
                      cx='64'
                      cy='64'
                      r='56'
                      stroke='#3d3d3d'
                      strokeWidth='8'
                      fill='transparent'
                    />
                    <circle
                      cx='64'
                      cy='64'
                      r='56'
                      stroke={percentage >= 90 ? '#10b981' : percentage >= 70 ? '#eab308' : percentage >= 50 ? '#f97316' : '#ef4444'}
                      strokeWidth='8'
                      fill='transparent'
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
                      strokeLinecap='round'
                      className='transition-all duration-1000'
                    />
                  </svg>
                  <div className='absolute inset-0 flex items-center justify-center'>
                    <span className={`text-2xl font-bold ${performanceColor}`}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <p className={`text-xl font-semibold ${performanceColor}`}>
                {performanceMessage}
              </p>
            </div>

            {/* Stats Grid */}
            <div className='grid grid-cols-2 gap-4'>
              <div className='bg-[#202020] border border-green-500/30 rounded-2xl p-4 text-center'>
                <div className='text-3xl font-bold text-green-400 mb-1'>{score}</div>
                <div className='text-sm text-gray-400'>Correct Answers</div>
              </div>
              <div className='bg-[#202020] border border-red-500/30 rounded-2xl p-4 text-center'>
                <div className='text-3xl font-bold text-red-400 mb-1'>{incorrect}</div>
                <div className='text-sm text-gray-400'>Incorrect Answers</div>
              </div>
            </div>

            {/* Question Review Section */}
            {incorrectQuestions.length > 0 && (
              <div className='bg-[#202020] border border-[#3d3d3d] rounded-2xl p-6 space-y-4'>
                <h3 className='text-xl font-bold text-white mb-4'>Review Incorrect Answers</h3>
                <div className='space-y-4'>
                  {incorrectQuestions.map((item) => {
                    const q = item.question;
                    return (
                      <div key={item.index} className='bg-[#1A1A1A] border border-red-500/20 rounded-xl p-4 space-y-3'>
                        <div className='flex items-start gap-3'>
                          <div className='w-8 h-8 rounded-full bg-red-500/20 text-red-400 border border-red-500/50 flex items-center justify-center text-sm font-bold shrink-0'>
                            {item.index + 1}
                          </div>
                          <div className='flex-1 space-y-2'>
                            <p className='text-white font-medium'>{q.question}</p>
                            <div className='space-y-1.5'>
                              <div className='text-xs text-red-400'>
                                Your answer: {q.type === 'mcq' ? q.options?.[item.userAnswer] || 'No answer' : String(item.userAnswer)}
                              </div>
                              <div className='text-xs text-green-400'>
                                Correct answer: {q.type === 'mcq' ? q.options?.[q.answer_index || 0] : String(item.correctAnswer)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Questions Overview */}
            <div className='bg-[#202020] border border-[#3d3d3d] rounded-2xl p-6'>
              <h3 className='text-lg font-bold text-white mb-4'>Question Overview</h3>
              <div className='grid grid-cols-5 gap-2'>
                {testData.questions.map((q: Question, idx: number) => {
                  const isCorrect = correctQuestions.includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                        isCorrect
                          ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50'
                          : 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
                      }`}
                      title={`Question ${idx + 1}: ${isCorrect ? 'Correct' : 'Incorrect'}`}
                    >
                      {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-4'>
              <button
                onClick={() => setScreen('test')}
                className='flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors'
              >
                Review Test
              </button>
              <button
                onClick={handleReset}
                className='flex-1 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors'
              >
                Create New Test
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;