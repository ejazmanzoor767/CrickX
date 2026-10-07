import {
  collection,
  onSnapshot,
  where,
  query,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getClientFirestore } from './firebase';

function rows(snapshot: QuerySnapshot<DocumentData>) {
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export function subscribeLiveMatches(onData: (rows: any[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(getClientFirestore(), 'liveMatches'), where('active', '==', true));
  return onSnapshot(q, (snapshot) => onData(rows(snapshot)), (error) => onError?.(error));
}

export function subscribeGlobalLeaderboard(onData: (rows: any[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(collection(getClientFirestore(), 'leaderboardUsers'), (snapshot) => onData(rows(snapshot)), (error) => onError?.(error));
}

export function subscribeFixtureLeaderboard(fixtureId: number, onData: (rows: any[]) => void, onError?: (error: Error) => void): Unsubscribe {
  const q = query(collection(getClientFirestore(), 'leaderboardMatchScores'), where('fixtureId', '==', fixtureId));
  return onSnapshot(q, (snapshot) => onData(rows(snapshot)), (error) => onError?.(error));
}
