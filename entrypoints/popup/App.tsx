import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { buildMultiTypePrompt, generateFallbackQuestions, Question } from './utils/testGeneration';
import { SavedTest } from './types';
import { TestType } from './components/TestTypeButtons';
import HomePage from './pages/HomePage';
import PreviewPage from './pages/PreviewPage';
import TestPage from './pages/TestPage';
import ResultsPage from './pages/ResultsPage';
import HistoryModal from './components/HistoryModal';
import icon from '../../assets/Icon.png';


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
  const [shouldCancel, setShouldCancel] = useState(false); // Flag to signal cancellation

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
function handleDismissAnswer() {
  setLlmResponse('');
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
    setShouldCancel(false); // Reset cancel flag when starting new generation

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
          // Check if user clicked cancel
          if (shouldCancel) {
            throw new Error('Generation cancelled by user');
          }

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

        // Check again before saving (in case cancel was clicked while processing)
        if (shouldCancel) {
          throw new Error('Generation cancelled by user');
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

      // Check if the question is about the current page
      const lowerPrompt = inputPrompt.toLowerCase();
      const needsPageContent = 
        lowerPrompt.includes('this page') ||
        lowerPrompt.includes('current page') ||
        lowerPrompt.includes('summarize') ||
        lowerPrompt.includes('summary') ||
        lowerPrompt.includes('what is this about') ||
        lowerPrompt.includes('explain this');

      let contextualPrompt = inputPrompt;

      // Fetch page content if needed
      if (needsPageContent) {
        try {
          const page = await fetchActiveTabContent();
          const pageText = `${page.title}\n\n${page.text}`.slice(0, 50000); // Limit to 50k chars
          contextualPrompt = `Based on the following page content, ${inputPrompt}\n\nPage Content:\n${pageText}`;
        } catch (e) {
          console.error('Failed to fetch page content:', e);
          // Continue with original prompt if fetch fails
        }
      }

      // Create a fresh session for Q&A (don't reuse the JSON generation session)
      const qaSession = await (self as any).LanguageModel.create({
        initialPrompts: [
          { role: 'system', content: 'You are a helpful assistant. Provide clear, concise answers in plain text. When summarizing, be thorough but concise.' }
        ],
        temperature: temperature,
        topK: topK
      });

      const result = await qaSession.prompt(contextualPrompt);
      setLlmResponse(result);
      
      // Clean up the Q&A session
      qaSession.destroy();
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
      <>
       <HomePage
  selectedTypes={selectedTypes}
  numQuestions={numQuestions}
  loading={loading}
  error={error}
  inputPrompt={inputPrompt}
  llmResponse={llmResponse}
  llmLoading={llmLoading}
  showHistory={showHistory}
  onToggleTestType={handleToggleTestType}
  onNumQuestionsChange={setNumQuestions}
  onGenerateMCQs={handleGenerateMCQs}
  onLLMQuestion={handleLLMQuestion}
  onInputPromptChange={setInputPrompt}
  onShowHistoryToggle={() => setShowHistory(!showHistory)}
  onReset={() => { setLoading(false); reset(); }}
  isTestGenerationRequest={isTestGenerationRequest}

  // NEW:
  onDismissAnswer={handleDismissAnswer}
/>
        <HistoryModal
          showHistory={showHistory}
          historyTab={historyTab}
          savedTests={savedTests}
          onClose={() => setShowHistory(false)}
          onTabChange={setHistoryTab}
          onArchiveTest={archiveTest}
          onUnarchiveTest={unarchiveTest}
          onDeleteTest={deleteSavedTest}
          onReviewTest={handleReviewTest}
          onRetakeTest={handleRetakeTest}
          onContinueTest={(test) => { loadSavedTest(test); setShowHistory(false); }}
        />
        {/* Loading Overlay */}
        {loading && (
          <div className='fixed inset-0 flex items-center justify-center  backdrop-blur-3xl bg-black/60 z-40'>
            <div className='w-[720px] relative  overflow-hidden' >
              {/* Header - Tab style */}
              <div className='pl-6'>


                <div className='flex items-center justify-between px-2 py-2 border border-white/5 bg-white/2 w-fit gap-3 rounded-full'>
                  <div className='flex items-center px-2 gap-3'>
                    {activeTabInfo?.favicon ? (
                      <img src={activeTabInfo.favicon} alt='site' className='w-6 h-6 rounded-sm   shrink-0' />
                    ) : (
                      <div className='w-6 h-6 rounded-sm  shrink-0' />
                    )}
                    <div className='text-sm text-neutral-100 font-normal line-clamp-1 max-w-xs'>{activeTabInfo?.title || 'Current page'}</div>
                  </div>
                  <button onClick={() => { setLoading(false); reset(); }} className='w-6 h-6 flex items-center justify-center rounded-sm hover:bg-white/20 shrink-0 ml-1'>
                    <X className='w-4 h-4 text-neutral-400 hover:text-neutral-200' />
                  </button>
                </div>
              </div>

              {/* Main content - two columns */}
              <div className='px-6 pt-4 flex gap-3'>
                {/* Left: preview + spinner */}
                <div className='flex-1 bg-black/20 rounded-xl p-4 border border-white/5'>
                  <div className='mb-3'>
                    <div className='text-xs text-neutral-400 mb-2'>Preview</div>
                    <div className='h-40 overflow-hidden rounded-md text-sm text-neutral-200 leading-relaxed'>
                      {/* Show a trimmed preview of the page text if available */}
                      {activeTabInfo?.title ? (
                        <div className='prose max-w-none wrap-break-word'>{activeTabInfo.title}</div>
                      ) : (
                        <div className='text-neutral-400'>Page content preview unavailable</div>
                      )}
                    </div>
                  </div>

                  <div className='flex items-start gap-3 w-full mt-4'>
                    {/* Left reserved column: fixed width so layout won't shrink if icon is removed */}
                    <div className='w-24 shrink-0 flex flex-col items-start'>
                      <img src={icon} alt='App icon' className='w-6 h-6 rounded-md object-cover border border-white/6' />
                      <div className='text-xs text-neutral-400 mt-2 text-start'>Generating test questions... This may take a moment.</div>
                    </div>

                    {/* Right area: keeps space for additional content in future */}
                    <div className='flex-1 flex items-center'>
                      {/* Intentionally left blank to preserve width and alignment */}
                    </div>
                  </div>
                </div>

                {/* Right: details & actions */}
                <div className='w-60 flex flex-col gap-3'>
                  <div className='bg-black/20 rounded-xl p-3 border border-white/5'>
                    <div className='text-xs text-neutral-400 mb-2'>Selected Types</div>
                    <div className='flex flex-wrap gap-2'>
                      {Array.from(selectedTypes).map(type => (
                        <span key={type} className='px-3 py-1 rounded-full bg-[#1b1b1b] text-neutral-200 text-[12px]'>
                          {type === 'mcq' ? 'MCQ' : type === 'true_false' ? 'True/False' : 'Fill In'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className='bg-black/20 rounded-xl p-4 border border-white/5 flex items-center justify-center text-yellow-400 font-bold text-2xl'>
                    {numQuestions}
                  </div>

                  <div className='mt-auto pb-1 flex flex-col gap-2'>
                    {/* <button onClick={() => { setLoading(false); setScreen('home'); }} className='w-full px-4 py-2 rounded-lg bg-[#1f1f2e] text-neutral-300 hover:bg-[#2a2a3d]'>Stop & Go Home</button> */}
                    <button onClick={() => { reset(); setLoading(false); chrome.storage.local.remove(['loading', 'generationCompleted', 'testData']); }} className='w-full px-4 py-4 rounded-full bg-yellow-500 font-serif text-black font-light border transition-colors border-yellow-500 hover:border-yellow-500 hover:border hover:bg-yellow-900 hover:text-white duration-500'>Cancel & Clear</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Preview Screen
  if (screen === 'preview' && testData) {
    return (
      <>
        <PreviewPage
          testData={testData}
          isSaving={isSaving}
          showHistory={showHistory}
          onGoHome={() => setScreen('home')}
          onShowHistoryToggle={() => setShowHistory(!showHistory)}
          onSaveTest={saveTest}
          onStartTest={handleStartTest}
        />
        <HistoryModal
          showHistory={showHistory}
          historyTab={historyTab}
          savedTests={savedTests}
          onClose={() => setShowHistory(false)}
          onTabChange={setHistoryTab}
          onArchiveTest={archiveTest}
          onUnarchiveTest={unarchiveTest}
          onDeleteTest={deleteSavedTest}
          onReviewTest={handleReviewTest}
          onRetakeTest={handleRetakeTest}
          onContinueTest={(test) => { loadSavedTest(test); setShowHistory(false); }}
        />
      </>
    );
  }

  // Test Screen
  if (screen === 'test' && testData) {
    return (
      <TestPage
        testData={testData}
        currentQuestion={currentQuestion}
        userAnswers={userAnswers}
        timeLeft={timeLeft}
        isSaving={isSaving}
        formatTime={formatTime}
        onGoHome={() => setScreen('home')}
        onSaveTest={saveTest}
        onAnswerSelect={handleAnswerSelect}
        onPreviousQuestion={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
        onNextQuestion={() => setCurrentQuestion(prev => Math.min(testData.questions.length - 1, prev + 1))}
        onGoToQuestion={(idx) => setCurrentQuestion(idx)}
        onSubmitTest={handleSubmitTest}
      />
    );
  }

  // Results Screen
  if (screen === 'results' && testData) {
    return (
      <ResultsPage
        testData={testData}
        userAnswers={userAnswers}
        calculateScore={calculateScore}
        onGoHome={() => setScreen('home')}
        onReviewTest={() => setScreen('test')}
        onCreateNewTest={handleReset}
      />
    );
  }

  return null;
}

export default App;