import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Donation,
  Beneficiary,
  Member,
  UserAccount,
  PortalSettings
} from '../types';

// Real-time collection subscriptions
export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  onData: (data: T[]) => void,
  initialDataIfEmpty?: T[]
): () => void {
  const colRef = collection(db, collectionName);

  const unsubscribe = onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty && initialDataIfEmpty && initialDataIfEmpty.length > 0) {
        // Seed initial data if collection is brand new
        const batch = writeBatch(db);
        initialDataIfEmpty.forEach((item) => {
          const itemRef = doc(db, collectionName, item.id);
          batch.set(itemRef, item);
        });
        await batch.commit().catch(console.error);
        return;
      }

      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as T);
      });
      onData(items);
    },
    (err) => {
      console.error(`Error subscribing to ${collectionName}:`, err);
    }
  );

  return unsubscribe;
}

// Single document subscription (e.g. settings)
export function subscribeDocument<T>(
  collectionName: string,
  docId: string,
  onData: (data: T) => void,
  initialDataIfEmpty?: T
): () => void {
  const docRef = doc(db, collectionName, docId);

  const unsubscribe = onSnapshot(
    docRef,
    async (docSnap) => {
      if (!docSnap.exists() && initialDataIfEmpty) {
        await setDoc(docRef, initialDataIfEmpty as any).catch(console.error);
        return;
      }
      if (docSnap.exists()) {
        onData(docSnap.data() as T);
      }
    },
    (err) => {
      console.error(`Error subscribing to ${collectionName}/${docId}:`, err);
    }
  );

  return unsubscribe;
}

// Helper methods to write data to Firestore
export async function saveToFirestore<T extends { id: string }>(
  collectionName: string,
  item: T
) {
  try {
    const docRef = doc(db, collectionName, item.id);
    console.log(`Saving to Firestore [${collectionName}]:`, item);
    await setDoc(docRef, item, { merge: true });
    console.log(`Successfully saved to Firestore [${collectionName}]`);
  } catch (err) {
    console.error(`Failed to save to Firestore [${collectionName}]:`, err);
    throw err; // Re-throw to be caught by the caller
  }
}

export async function deleteFromFirestore(collectionName: string, id: string) {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Failed to delete from Firestore [${collectionName}]:`, err);
  }
}

export async function saveDocToFirestore<T>(
  collectionName: string,
  docId: string,
  data: T
) {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, data as any, { merge: true });
  } catch (err) {
    console.error(`Failed to save doc to Firestore [${collectionName}/${docId}]:`, err);
  }
}
