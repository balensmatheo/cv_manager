import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'cv-app-storage',
  access: (allow) => ({
    'private/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
});
