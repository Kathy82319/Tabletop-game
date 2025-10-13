// functions/api/admin/update-rental-status.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const { rentalId, status } = await context.request.json();
    if (!rentalId || !status) {
      return new Response(JSON.stringify({ error: '缺少租借 ID 或狀態。' }), { status: 400 });
    }

    const db = context.env.DB;
    const rental = await db.prepare('SELECT game_id, status FROM Rentals WHERE rental_id = ?').bind(rentalId).first();
    if (!rental) {
        return new Response(JSON.stringify({ error: `找不到租借 ID: ${rentalId}` }), { status: 404 });
    }
    if (rental.status === 'returned' && status === 'returned') {
        return new Response(JSON.stringify({ success: true, message: '此筆紀錄已歸還，無需重複操作。' }), { status: 200 });
    }

    const batchOperations = [];
    const returnDate = status === 'returned' ? new Date().toISOString().split('T')[0] : null;

    batchOperations.push(
        db.prepare('UPDATE Rentals SET status = ?, return_date = ? WHERE rental_id = ?')
          .bind(status, returnDate, rentalId)
    );

    if (status === 'returned') {
        batchOperations.push(
            db.prepare('UPDATE BoardGames SET for_rent_stock = for_rent_stock + 1 WHERE game_id = ?')
              .bind(rental.game_id)
        );
    }

    await db.batch(batchOperations);

    return new Response(JSON.stringify({ success: true, message: '成功更新租借狀態與庫存！' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-rental-status API:', error);
    return new Response(JSON.stringify({ error: '更新租借狀態失敗。' }), { status: 500 });
  }
}