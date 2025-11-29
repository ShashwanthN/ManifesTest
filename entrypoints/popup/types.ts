export interface SavedTest {
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

