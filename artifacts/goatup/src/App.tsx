import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { SocketProvider } from '@/lib/socket';

import { RootRedirect } from './pages/root-redirect';
import Login from './pages/login';
import Signup from './pages/signup';
import ForgotPassword from './pages/forgot-password';
import ForgotUsername from './pages/forgot-username';
import ChatMain from './pages/chat/index';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/forgot-username" component={ForgotUsername} />
      <Route path="/chat" component={ChatMain} />
      <Route path="/chat/:id" component={ChatMain} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </SocketProvider>
    </QueryClientProvider>
  );
}

export default App;
