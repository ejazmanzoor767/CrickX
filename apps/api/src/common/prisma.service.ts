// Backward-compatible alias for the Firestore-backed data service.
// Existing application modules still import PrismaService, so keep this
// symbol while routing all persistence through FirestoreService.
export { FirestoreService as PrismaService } from './firestore.service';
