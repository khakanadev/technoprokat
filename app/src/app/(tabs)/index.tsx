import { Redirect } from 'expo-router';
import { isStaffRole, useSession } from '../../lib/session';

// Стартовый экран: клиент начинает с каталога, сотрудник — со списка аренд
export default function Index() {
  const { user } = useSession();
  return <Redirect href={isStaffRole(user) ? '/rentals' : '/catalog'} />;
}
