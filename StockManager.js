/**
 * StockManager.gs - Gestiona las salidas y utilidades de stock/inventario.
 */

function registrarMovimientoStock(tipoMovimiento, datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsItems = ss.getSheetByName(CONFIG.SHEET_ITEMS);
  const fechaHoy = new Date();
  
  // Datos desestructurados
  const { codigo, cantidad, runPaciente, nombrePaciente, obs, usuarioResponsable, convenioSnapshot, atencionSnapshot } = datos;
  
  // 1. BUSCAR PRODUCTO EN MAESTRO DE ITEMS
  const dataItems = wsItems.getDataRange().getValues();
  let filaItem = -1;
  let stockActual = 0;
  let nombreItem = "";

  for (let i = 1; i < dataItems.length; i++) {
    if (String(dataItems[i][COL_ITEMS.CODIGO - 1]) === String(codigo)) {
      filaItem = i + 1;
      nombreItem = dataItems[i][COL_ITEMS.NOMBRE - 1];
      stockActual = Number(dataItems[i][COL_ITEMS.STOCK - 1]);
      if (isNaN(stockActual)) stockActual = 0;
      break;
    }
  }

  if (filaItem === -1) {
    throw new Error(`Producto no encontrado: ${codigo}`);
  }

  // 2. PROCESAR SALIDA (ATENCIÓN CLÍNICA)
  if (tipoMovimiento === "SALIDA") {
    
    // Validación de Stock
    if (stockActual < cantidad) {
      throw new Error(`Stock insuficiente para "${nombreItem}". Actual: ${stockActual}, Solicitado: ${cantidad}`);
    }
    
    // Descuento
    const nuevoStock = stockActual - cantidad;
    wsItems.getRange(filaItem, COL_ITEMS.STOCK).setValue(nuevoStock);

    // NOTA: El registro en "Historial_Atenciones" y "Detalle_Movimientos" 
    // lo maneja "ControladorAtencion.gs" para asegurar que la cabecera y el detalle coincidan.
    // Esta función se usa principalmente para validar y descontar el físico.
    
    return { success: true, nuevoStock: nuevoStock };
  }
  
  // Si en el futuro se necesita un "AJUSTE" o "MERMA", se podría agregar aquí.
}

/**
 * Función auxiliar para actualizar stock directamente sin generar historial clínico.
 * Usada por el módulo de Ingresos Masivos.
 */
function actualizarStockDirecto(codigo, cantidadCambio) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsItems = ss.getSheetByName(CONFIG.SHEET_ITEMS);
  const dataItems = wsItems.getDataRange().getValues();
  
  for (let i = 1; i < dataItems.length; i++) {
    if (String(dataItems[i][COL_ITEMS.CODIGO - 1]) === String(codigo)) {
      const stockActual = Number(dataItems[i][COL_ITEMS.STOCK - 1]) || 0;
      const nuevoStock = stockActual + cantidadCambio;
      wsItems.getRange(i + 1, COL_ITEMS.STOCK).setValue(nuevoStock);
      return true;
    }
  }
  return false;
}