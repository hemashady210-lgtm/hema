import { createBrowserRouter } from 'react-router';
import { NotFoundPage } from '@/features/system/NotFoundPage';

export const router = createBrowserRouter([{ path: '*', element: <NotFoundPage /> }]);
