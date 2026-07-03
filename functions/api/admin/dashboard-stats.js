// functions/api/admin/dashboard-stats.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const db = context.env.DB;
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0, 7); // YYYY-MM

    const [todayBookings, outstandingRentals, dueTodayRentals, pendingGatherings, newMembers] = await Promise.all([
      db.prepare(
        "SELECT SUM(num_of_people) as total_people FROM Bookings WHERE booking_date = ? AND status IN ('confirmed', 'checked-in')"
      ).bind(today).first(),

      db.prepare(
        "SELECT COUNT(*) as outstanding_rentals FROM Rentals WHERE status = 'rented'"
      ).first(),

      db.prepare(
        "SELECT COUNT(*) as due_today_count FROM Rentals WHERE due_date = ? AND status = 'rented'"
      ).bind(today).first(),

      db.prepare(
        "SELECT COUNT(*) as pending_count FROM GroupGatherings WHERE status = 'pending_approval'"
      ).first(),

      db.prepare(
        "SELECT COUNT(*) as new_count FROM Users WHERE strftime('%Y-%m', created_at) = ?"
      ).bind(thisMonth).first(),
    ]);

    const stats = {
      today_total_guests: todayBookings?.total_people || 0,
      outstanding_rentals_count: outstandingRentals?.outstanding_rentals || 0,
      due_today_rentals_count: dueTodayRentals?.due_today_count || 0,
      pending_gatherings_count: pendingGatherings?.pending_count || 0,
      new_members_this_month: newMembers?.new_count || 0,
    };

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in dashboard-stats API:', error);
    return new Response(JSON.stringify({ error: '獲取儀表板數據失敗。', details: error.message }), {
      status: 500,
    });
  }
}
