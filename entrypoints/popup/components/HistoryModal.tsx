import { X, History, Archive, ArchiveRestore, Trash2, RotateCcw, Eye } from 'lucide-react';
import { SavedTest } from '../types';

interface HistoryModalProps {
  showHistory: boolean;
  historyTab: 'active' | 'completed' | 'archived';
  savedTests: SavedTest[];
  onClose: () => void;
  onTabChange: (tab: 'active' | 'completed' | 'archived') => void;
  onArchiveTest: (id: string) => void;
  onUnarchiveTest: (id: string) => void;
  onDeleteTest: (id: string) => void;
  onReviewTest: (test: SavedTest) => void;
  onRetakeTest: (test: SavedTest) => void;
  onContinueTest: (test: SavedTest) => void;
}

export default function HistoryModal({
  showHistory,
  historyTab,
  savedTests,
  onClose,
  onTabChange,
  onArchiveTest,
  onUnarchiveTest,
  onDeleteTest,
  onReviewTest,
  onRetakeTest,
  onContinueTest
}: HistoryModalProps) {
  if (!showHistory) return null;

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black/80 z-[100]' onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className='bg-[#202020] border border-[#3d3d3d] rounded-2xl p-6 w-[90%] max-w-md overflow-hidden' onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div className='flex items-center justify-between mb-4 sticky top-0 bg-[#202020] z-10 pb-2'>
          <h2 className='text-xl text-white font-serif font-normal'>Test History</h2>
          <button 
            onClick={onClose}
            className='w-8 h-8 flex items-center justify-center hover:bg-[#3A3A3A] rounded-lg transition-colors'
          >
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>
        
        {/* Tabs */}
        <div className='flex gap-2 mb-4 border-b border-[#3d3d3d]'>
          <button
            onClick={() => onTabChange('active')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              historyTab === 'active' 
                ? 'text-yellow-400 border-b-2 border-yellow-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Active ({savedTests.filter(t => !t.isCompleted && !t.isArchived).length})
          </button>
          <button
            onClick={() => onTabChange('completed')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              historyTab === 'completed' 
                ? 'text-yellow-400 border-b-2 border-yellow-400' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Completed ({savedTests.filter(t => t.isCompleted && !t.isArchived).length})
          </button>
          <button
            onClick={() => onTabChange('archived')}
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
                            onClick={() => onUnarchiveTest(test.id)}
                            className='w-7 h-7 flex items-center justify-center hover:bg-blue-500/20 rounded transition-colors'
                            title='Unarchive'
                          >
                            <ArchiveRestore className='w-4 h-4 text-blue-400' />
                          </button>
                        ) : (
                          <button
                            onClick={() => onArchiveTest(test.id)}
                            className='w-7 h-7 flex items-center justify-center hover:bg-gray-500/20 rounded transition-colors'
                            title='Archive'
                          >
                            <Archive className='w-4 h-4 text-gray-400' />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteTest(test.id)}
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
                            onClick={() => onReviewTest(test)}
                            className='flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2'
                          >
                            <Eye className='w-4 h-4' />
                            Review
                          </button>
                          <button
                            onClick={() => onRetakeTest(test)}
                            className='flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2'
                          >
                            <RotateCcw className='w-4 h-4' />
                            Retake
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onContinueTest(test)}
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
  );
}

