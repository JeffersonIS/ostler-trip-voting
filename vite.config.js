import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Project Pages are served from /<repository>/, not from the domain root.
  // GitHub supplies GITHUB_REPOSITORY as "owner/repository" during Actions.
  base: process.env.GITHUB_ACTIONS
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/',
})
