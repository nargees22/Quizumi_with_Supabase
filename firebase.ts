
// Firebase temporarily disabled during Supabase migration

// Fix: Proper mock for db to prevent collection() errors
const dbMock = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: async () => ({ exists: false, data: () => ({}) }),
      set: async () => {},
      update: async () => {},
      onSnapshot: (callback: any) => {
        // Return a dummy unsubscribe function
        return () => {};
      },
      collection: (subName: string) => ({
        get: async () => ({ docs: [] }),
        doc: (subId: string) => ({
          set: async () => {},
          update: async () => {},
        }),
        onSnapshot: (callback: any) => {
          return () => {};
        }
      })
    }),
    where: () => ({
      orderBy: () => ({
        limit: () => ({
          get: async () => ({ docs: [] })
        })
      }),
      get: async () => ({ docs: [] })
    })
  })
};

export const db = dbMock as any;

// Fix: Mocking firebase to avoid "Property 'firestore' does not exist on type '{}'" errors
const firebaseMock = {
  firestore: {
    FieldValue: {
      arrayUnion: (val: any) => val,
      increment: (val: any) => val,
      serverTimestamp: () => new Date(),
    }
  }
} as any;

export const firebase = firebaseMock;
export default firebaseMock;
