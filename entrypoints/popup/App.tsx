import { useState, useEffect } from 'react';
import { marked } from 'marked';
import { Clock, Settings, Plus, Search, Send } from 'lucide-react';

function App() {
  const [inputPrompt, setInputPrompt] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [topK, setTopK] = useState(3);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<any>(null);
  const [defaultTemp, setDefaultTemp] = useState(1.0);
  const [maxTopK, setMaxTopK] = useState(8);

  // Load saved state on initial mount
  useEffect(() => {
    loadSavedState();
    initDefaults();
  }, []);

  // Save state changes
  useEffect(() => {
    saveState();
  }, [inputPrompt, temperature, topK, response, error]);

  async function initDefaults() {
    try {
      if (!('LanguageModel' in self)) {
        setError('Model not available');
        return;
      }
      const defaults = await (self as any).LanguageModel.params();
      console.log('Model default:', defaults);
      setDefaultTemp(defaults.defaultTemperature);
      setTemperature(defaults.defaultTemperature);
      const limitedTopK = defaults.defaultTopK > 3 ? 3 : defaults.defaultTopK;
      setTopK(limitedTopK);
      setMaxTopK(defaults.maxTopK);
    } catch (e) {
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
    } catch (e) {
      console.log('Prompt failed');
      console.error(e);
      console.log('Prompt:', prompt);
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

  function handleTemperatureChange(value: number) {
    setTemperature(value);
    reset();
  }

  function handleTopKChange(value: number) {
    setTopK(value);
    reset();
  }

  async function handlePromptSubmit() {
    const prompt = inputPrompt.trim();
    if (!prompt) return;

    setLoading(true);
    setError('');
    setResponse('');

    try {
      const params = {
        initialPrompts: [
          { role: 'system', content: 'You are a helpful and friendly assistant.' }
        ],
        temperature: temperature,
        topK: topK
      };
      const result = await runPrompt(prompt, params);
      setResponse(result);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateMCQs() {
    setLoading(true);
    setError('');
    setResponse('');

    try {
      if (!chrome.scripting) {
        throw new Error('chrome.scripting API not available. Ensure the extension has the scripting permission and is running in Chrome.');
      }

      const page = await fetchActiveTabContent();
      const pageText = `${page.title}\n\n${page.text}`.slice(0, 200000);

      const generationPrompt = `You are an assistant that creates 10 concise multiple-choice questions (4 options each) about the following webpage content. Return strictly valid JSON with this shape: {"questions": [{"question": "...", "options": ["...","...","...","..."], "answer_index": 0}], "source_title": "..."}. Only return the JSON object and nothing else. Webpage content:\n\n${pageText}`;

      if (!('LanguageModel' in self)) {
        const fallback = generateFallbackMCQs(page);
        setResponse(JSON.stringify(fallback, null, 2));
        return;
      }

      const params = {
        initialPrompts: [
          { role: 'system', content: 'You are a helpful assistant that outputs only JSON.' }
        ],
        temperature: 0.2,
        topK: Math.min(3, topK)
      };

      const result = await runPrompt(generationPrompt, params);

      try {
        const parsed = JSON.parse(result);
        setResponse(JSON.stringify(parsed, null, 2));
      } catch (err) {
        console.warn('JSON parse failed, showing raw response', err);
        setResponse(result + '\n\n(Warning: response was not valid JSON)');
      }
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }

  async function fetchActiveTabContent() {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs || !tabs.length) {
      throw new Error('No active tab found');
    }
    const tab = tabs[0];
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => ({ title: document.title, text: document.body.innerText })
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

    qlist.push({
      question: `What is the title of the page?`,
      options: [title, `${title} - overview`, `About ${title}`, `Introduction`],
      answer_index: 0
    });

    for (let i = 0; i < Math.min(4, sentences.length); i++) {
      const s = sentences[i].slice(0, 120);
      qlist.push({
        question: `Which statement best summarizes: "${s}"?`,
        options: [s, 'An unrelated statement', 'A minor detail', 'A conclusion not supported'],
        answer_index: 0
      });
    }

    while (qlist.length < 10) {
      qlist.push({
        question: `Which concept is covered on this page?`,
        options: ['The main concept', 'Unrelated concept', 'A different topic', 'Not discussed'],
        answer_index: 0
      });
    }
    return { source_title: title, questions: qlist };
  }

  async function loadSavedState() {
    try {
      const result = await chrome.storage.local.get([
        'inputPrompt',
        'temperature',
        'topK',
        'response',
        'error'
      ]);

      if (result.inputPrompt) setInputPrompt(result.inputPrompt);
      if (result.temperature) setTemperature(result.temperature);
      if (result.topK) setTopK(result.topK);
      if (result.response) setResponse(result.response);
      if (result.error) setError(result.error);
    } catch (e) {
      console.error('Failed to load saved state:', e);
    }
  }

  async function saveState() {
    try {
      await chrome.storage.local.set({
        inputPrompt,
        temperature,
        topK,
        response,
        error
      });
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  // Modify handleReset to also clear storage
  function handleReset() {
    setResponse('');
    setError('');
    setLoading(false);
    setInputPrompt('');
    reset();
    // Clear storage
    chrome.storage.local.clear();
  }

  return (
    <div className="popup w-full h-screen bg-[#1A1A1A] flex flex-col justify-between">
      {/* Header */}
      <div className='flex justify-between items-center px-4 pt-4 pb-1'>
        <button className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'>
          <Clock className='w-5 h-5 text-gray-400' />
        </button>
        <h1 className="text-[18px] items-center justify-center font-sans tracking-wide text-neutral-200">
          Manifes<span className='font-bold italic text-md text-yellow-400'>T</span><span className='text-yellow-400'>est</span>
        </h1>
        <button className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'>
          <Settings className='w-5 h-5 text-gray-400' />
        </button>
      </div>

      {/* Info Section */}
      <div className='pt-1'>
        <div className="px-7">
          <h1 className="text-[16px] font-medium tracking-wide text-neutral-300">
            Open a File or Webpage to Create a Test
          </h1>
          <p className="text-xs font-light tracking-wide text-neutral-500">
            No relevant content was found on this site.
          </p>
        </div>
      </div>

      {/* Hide AI Parameters from UI */}
      {(loading || error || response) && (
        <div className="px-4 pb-2">
          {loading && (
            <div className="mt-2 p-4 bg-[#202020] rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.16),0_0_0_3px_rgb(51,51,51)]">
              <span className="animate-pulse text-neutral-300">...</span>
            </div>
          )}
          {error && (
            <div className="mt-2 p-4 bg-[#202020] rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.16),0_0_0_3px_rgb(51,51,51)] text-red-600">
              {error}
            </div>
          )}
          {response && !loading && (
            <div
              className="mt-2 p-4 bg-[#202020] rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.16),0_0_0_3px_rgb(51,51,51)] max-h-[300px] overflow-y-auto text-neutral-200"
              dangerouslySetInnerHTML={{ __html: marked.parse(response) }}
            />
          )}
        </div>
      )}

      {!loading && !error && !response && (
        <div className='flex-1 flex items-center justify-center p-2 overflow-hidden'>
          <div className='border-2 border-dashed border-[#3A3A3A] rounded-2xl p-4 md:p-8 w-1/2 max-w-md flex flex-col items-center justify-between gap-4 my-4 max-h-[60vh] md:max-h-[50vh] overflow-hidden'>
            <div className='flex-1 flex items-center justify-center'>
              <div className='w-12 h-12 md:w-8 md:h-8 flex items-center pt-2 justify-center'>
                <Plus className='w-10 h-10 md:w-14 md:h-14 text-yellow-500' strokeWidth={1.5} />
              </div>
            </div>
            <div className='text-center space-y-1'>
              <p className='text-md md:text-xl text-gray-300 font-medium tracking-wide'>Drop Files Here</p>
              <p className='text-[12px] text-gray-500'>.pdf, .doc and .docx</p>
            </div>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className='w-full flex justify-center pb-4 px-4 shrink-0'>
        <div className='w-full max-w-2xl'>
          <div className='rounded-xl px-2 py-2 bg-[#202020] border border-[#3d3d3d] flex flex-col gap-1'>
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder='Type a topic or add a link'
              className='bg-transparent w-full outline-none text-neutral-300 placeholder-neutral-500 py-1 pb-2 text-[12px] font-light tracking-wide'
            />
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <button className='w-6 h-6 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors'>
                  <Plus className='w-5 h-5 text-yellow-500' strokeWidth={2.5} />
                </button>
                <button
                  className='w-6 h-6 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors'
                  onClick={handleGenerateMCQs}
                >
                  <Search className='w-4 h-4 text-yellow-500' strokeWidth={2.5} />
                </button>
              </div>
              {inputPrompt.trim() && (
                <button
                  className='w-6 h-6 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors'
                  onClick={handlePromptSubmit}
                >
                  <Send className='w-4 h-4 text-yellow-500' strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}

export default App;