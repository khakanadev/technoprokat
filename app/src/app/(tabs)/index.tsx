import { Redirect } from 'expo-router';
import { isStaffRole, useSession } from '../../lib/session';

export default function Index() {
  const { user } = useSession();
  return <Redirect href={isStaffRole(user) ? '/rentals' : '/catalog'} />;
}
