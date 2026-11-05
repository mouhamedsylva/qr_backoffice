/** Formatage des montants et dates dans la devise et le fuseau du restaurant actif. */
export function useMoney() {
  const restaurant = useRestaurantStore();
  return {
    money: (amount: number, currency?: string) =>
      formatMoney(amount, currency ?? restaurant.currency, restaurant.locale),
    dateTime: (date: string | Date, options?: Intl.DateTimeFormatOptions) =>
      formatDateTime(date, restaurant.timezone, options),
    time: (date: string | Date) =>
      formatDateTime(date, restaurant.timezone, { hour: '2-digit', minute: '2-digit' }),
  };
}
