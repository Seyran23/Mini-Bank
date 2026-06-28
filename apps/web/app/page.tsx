import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const store = await cookies();
  redirect(store.has('access_token') ? '/accounts' : '/login');
}
