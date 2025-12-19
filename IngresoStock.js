/**
 * IngresoStock.gs - Backend para el Modal de Reabastecimiento.
 */

function mostrarModalIngresoStock() {
  const html = HtmlService.createHtmlOutputFromFile('ModalIngresoStock')
      .setWidth(800)
      .setHeight(600);
  SpreadsheetApp.getUi().showModelessDialog(html, '📥 Re-abastecimiento de Insumos');
}

/** 
 * Obtiene la lista completa de insumos para la tabla
*/
function obtenerDatosInicialesBodega() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(CONFIG.SHEET_ITEMS);
  // Leemos todas las columnas hasta PRECIO para tener MINIMO
  const data = ws.getRange(2, 1, ws.getLastRow()-1, 6).getValues(); 
  
  const insumos = data
    .filter(row => row[COL_ITEMS.TIPO - 1] === "INSUMO")
    .map(r => {
      const stockActual = Number(r[COL_ITEMS.STOCK - 1]) || 0;
      const stockMinimo = Number(r[COL_ITEMS.MINIMO - 1]) || 0;
      
      return { 
        codigo: r[COL_ITEMS.CODIGO - 1], 
        nombre: r[COL_ITEMS.NOMBRE - 1],
        stockActual: stockActual,
        esCritico: stockActual <= stockMinimo
      };
    });

  return { insumos, usuarios: CONFIG.USUARIOS_AUTORIZADOS };
}

/**
 * Procesa el Ingreso Masivo con estructura CABECERA - DETALLE
 */
function procesarIngresoMasivo(formulario) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsCargas = ss.getSheetByName(CONFIG.SHEET_CARGAS);     // Registro_Cargas
  const wsDetalle = ss.getSheetByName(CONFIG.SHEET_INGRESOS);  // Detalle_Ingresos
  const fechaHoy = new Date();
  
  // Generamos ID de Carga: "ING-Fecha-Random"
  const idCarga = `ING-${Utilities.formatDate(fechaHoy, "GMT-3", "ddMM")}-${Utilities.getUuid().substring(0,4)}`;

  try {
    // 1. GUARDAR CABECERA (Registro_Cargas)
    // Columnas: ID, FECHA, USUARIO, REFERENCIA, CANT_ITEMS
    wsCargas.appendRow([
      idCarga,
      fechaHoy,
      formulario.usuario,
      formulario.referencia || "Reabastecimiento General",
      formulario.items.length
    ]);

    // 2. PROCESAR DETALLE Y STOCK
    let procesados = 0;
    
    formulario.items.forEach(item => {
      const cantidad = Number(item.cantidad);
      
      // A. Guardar Detalle (Detalle_Ingresos)
      // Columnas: ID_CARGA, CODIGO, NOMBRE, CANTIDAD
      // Buscamos el nombre en el objeto item (lo mandamos desde el html para ahorrar búsquedas)
      wsDetalle.appendRow([
        idCarga,
        item.codigo,
        item.nombre, // Asegurarnos de enviar esto desde el HTML
        cantidad
      ]);

      // B. Actualizar Stock Físico (BD_Items)
      actualizarStockDirecto(item.codigo, cantidad); // Usamos la función de StockManager
      procesados++;
    });

    return { success: true, count: procesados, idLote: idCarga };

  } catch (e) {
    return { success: false, error: e.message };
  }
}