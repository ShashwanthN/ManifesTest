import { Home } from 'lucide-react';
import { Question } from '../utils/testGeneration';

interface ResultsPageProps {
  testData: any;
  userAnswers: any;
  calculateScore: () => number;
  onGoHome: () => void;
  onReviewTest: () => void;
  onCreateNewTest: () => void;
}

export default function ResultsPage({
  testData,
  userAnswers,
  calculateScore,
  onGoHome,
  onReviewTest,
  onCreateNewTest
}: ResultsPageProps) {
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
      <div className='flex justify-between items-center px-6 pt-6 pb-4 border-b border-neutral-800'>
        <button
          onClick={onGoHome}
          className='w-10 h-10 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors'
        >
          <Home className='w-5 h-5 text-neutral-400' />
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
              <div className='text-4xl text-neutral-500'>/</div>
              <div className='text-7xl font-bold text-neutral-400'>
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
              <div className='text-sm text-neutral-400'>Correct Answers</div>
            </div>
            <div className='bg-[#202020] border border-red-500/30 rounded-2xl p-4 text-center'>
              <div className='text-3xl font-bold text-red-400 mb-1'>{incorrect}</div>
              <div className='text-sm text-neutral-400'>Incorrect Answers</div>
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
              onClick={onReviewTest}
              className='flex-1 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-xl transition-colors'
            >
              Review Test
            </button>
            <button
              onClick={onCreateNewTest}
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

