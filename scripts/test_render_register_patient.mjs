import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock browser window/localStorage if needed
if (typeof window === 'undefined') {
  global.window = {};
}
if (typeof localStorage === 'undefined') {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

async function testRender() {
  console.log('Testing RegisterPatient component rendering...');
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  try {
    const mod = await import('../src/pages/reception/RegisterPatient.jsx');
    const RegisterPatient = mod.default;

    console.log('Module loaded. RegisterPatient is:', typeof RegisterPatient);

    const html = ReactDOMServer.renderToString(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(RegisterPatient)
      )
    );

    console.log('Rendered successfully! HTML length:', html.length);
    console.log('HTML snippet:', html.slice(0, 300));
  } catch (err) {
    console.error('💥 ERROR during render of RegisterPatient:');
    console.error(err);
  }
}

testRender();
