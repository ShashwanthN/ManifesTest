import { useState, useEffect } from 'react';
import { marked } from 'marked';

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

  useEffect(() => {
    initDefaults();
  }, []);

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

  function handleReset() {
    setResponse('');
    setError('');
    setLoading(false);
    reset();
  }

  return (
    <div className="w-[400px] min-h-[500px] p-2 bg-[#f2f2f2]">
      <textarea
        value={inputPrompt}
        onChange={(e) => setInputPrompt(e.target.value)}
        placeholder='Type something, e.g. "Write a haiku about Chrome Extensions"'
        className="w-full p-4 bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.16),0_0_0_3px_rgb(51,51,51)] outline-none resize-none"
        rows={5}
      />

      <div className="mt-4">
        <input
          type="range"
          value={temperature}
          onChange={(e) => handleTemperatureChange(Number(e.target.value))}
          min="0"
          max="2"
          step="0.01"
          className="w-full accent-black"
        />
        <label className="text-sm">
          Temperature: <span>{temperature}</span>
        </label>
      </div>

      <div className="mt-4">
        <input
          type="range"
          value={topK}
          onChange={(e) => handleTopKChange(Number(e.target.value))}
          min="1"
          max={maxTopK}
          step="1"
          className="w-full accent-black"
        />
        <label className="text-sm">
          Top-k: <span>{topK}</span>
        </label>
      </div>

      <button
        onClick={handlePromptSubmit}
        disabled={!inputPrompt.trim()}
        className="w-full bg-green-500 text-white rounded-lg border-none min-h-[40px] px-2 py-2 mt-4 cursor-pointer disabled:bg-[#ddd] disabled:text-[#aaa] disabled:cursor-not-allowed"
      >
        Run
      </button>

      <button
        onClick={handleGenerateMCQs}
        className="w-full bg-[#333] text-white rounded-lg border-none min-h-[40px] px-2 py-2 mt-4 cursor-pointer"
      >
        Generate MCQs from page
      </button>

      <button
        onClick={handleReset}
        disabled={!response && !error && !loading}
        className="w-full bg-[#ccc] text-black rounded-lg border-none min-h-[40px] px-2 py-2 mt-4 cursor-pointer disabled:bg-[#ddd] disabled:text-[#aaa] disabled:cursor-not-allowed"
      >
        Reset
      </button>

      {loading && (
        <div className="mt-4 p-4 bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.16),0_0_0_3px_rgb(51,51,51)]">
          <span className="animate-pulse">...</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.16),0_0_0_3px_rgb(51,51,51)] text-red-600">
          {error}
        </div>
      )}

      {response && !loading && (
        <div 
          className="mt-4 p-4 bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.16),0_0_0_3px_rgb(51,51,51)] max-h-[300px] overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: marked.parse(response) }}
        />
      )}
    </div>
  );
}

export default App;