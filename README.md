1. Click "Use this template" and name your repository.

2. Install dependencies.

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

4. Next, make your modifications. For example, go to https://v0.dev and create your landing page. If you do this, you need to download the project from v0.dev and replace the files of your project with the files of the project you downloaded from v0.dev. These are mostly the files in the `app/page.tsx`, `app/globals.css`, and `app/layout.tsx` files, and maybe certain components in the `components` folder.

5. Install Shadcn and the required components of your app. If you do this, you need to install Shadcn and the required components of your app:

```bash
npm install @shadcn/ui
```

6. Install the components you need:

```bash
npx shadcn@latest add button
```

...or whatever component you need...

7. Before depploying to vercel you might want to disable errors which could appear through linting errors, for that add to `next.config.js` the following:

```javascript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
```

8. Deploy to Vercel:

```bash
vercel
```