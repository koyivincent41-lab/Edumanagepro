import { GradingSystem, ExamResult } from '../types';

export function getGradeFromScore(score: number, gradingSystem: GradingSystem | null) {
  if (!gradingSystem || !gradingSystem.bands) return { grade: 'N/A', remarks: '', isPass: false };
  const roundedScore = Math.round(score);
  const band = gradingSystem.bands.find(b => roundedScore >= b.minScore && roundedScore <= b.maxScore);
  return {
    grade: band?.gradeName || 'N/A',
    remarks: band?.remarks || '',
    isPass: band ? (band.gradeName !== 'E' && band.gradeName !== 'F') : false // Default Pass/Fail logic if not explicit
  };
}

export function calculateRank(data: any[], key: string) {
  const sorted = [...data].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const result = [...data];
  
  let currentRank = 1;
  let skipCount = 0;
  
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][key] === sorted[i - 1][key]) {
      skipCount++;
    } else {
      currentRank += skipCount;
      skipCount = 1;
      if (i === 0) skipCount = 1; else skipCount = 1; // reset skip
    }
    // Actually simpler logic for competition ranking:
    // 1, 2, 2, 4
  }

  // Refined Competition Ranking (Standard):
  const ranked = sorted.map((student, index) => {
    let rank = index + 1;
    if (index > 0 && student[key] === sorted[index - 1][key]) {
      rank = (sorted[index - 1] as any).rank;
    }
    return { ...student, rank };
  });

  return ranked;
}

export interface AcademicStats {
  meanScore: number;
  meanGrade: string;
  totalCandidates: number;
  passRate: number;
  highestScore: number;
  lowestScore: number;
  gradeDistribution: Record<string, number>;
}

export function calculateAcademicStats(results: ExamResult[], gradingSystem: GradingSystem | null): AcademicStats {
  if (results.length === 0) {
    return { meanScore: 0, meanGrade: 'N/A', totalCandidates: 0, passRate: 0, highestScore: 0, lowestScore: 0, gradeDistribution: {} };
  }

  const scores = results.map(r => r.scoreObtained);
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const meanScore = totalScore / results.length;
  const meanGrade = getGradeFromScore(meanScore, gradingSystem).grade;
  
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  
  const gradeDistribution: Record<string, number> = {};
  let passCount = 0;

  results.forEach(r => {
    const { grade, isPass } = getGradeFromScore(r.scoreObtained, gradingSystem);
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    if (isPass) passCount++;
  });

  const passRate = (passCount / results.length) * 100;

  return {
    meanScore,
    meanGrade,
    totalCandidates: results.length,
    passRate,
    highestScore,
    lowestScore,
    gradeDistribution
  };
}
