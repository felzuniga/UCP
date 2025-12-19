/**
 * ControladorAtencion.gs - Gestiona la interfaz de atención y el registro de salidas.
 */

function mostrarModalAtencion() {
  const html = HtmlService.createHtmlOutputFromFile('ModalAtencion')
      .setWidth(900).setHeight(700);
  SpreadsheetApp.getUi().showModelessDialog(html, '📝 Registro de Atención');
}

function obtenerDatosInicialesAtencion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsItems = ss.getSheetByName(CONFIG.SHEET_ITEMS);
  const data = wsItems.getRange(2, 1, wsItems.getLastRow()-1, 6).getValues();
  
  const items = data.map(r => ({
    codigo: r[COL_ITEMS.CODIGO - 1], 
    nombre: r[COL_ITEMS.NOMBRE - 1], 
    tipo: r[COL_ITEMS.TIPO - 1], 
    stock: Number(r[COL_ITEMS.STOCK - 1]) || 0, 
    precio: Number(r[COL_ITEMS.PRECIO - 1]) || 0 
  }));

  return { items, usuarios: CONFIG.USUARIOS_AUTORIZADOS };
}

function buscarAtencionPendiente(run) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsAtenciones = ss.getSheetByName(CONFIG.SHEET_ATENCIONES);
  const wsDetalle = ss.getSheetByName(CONFIG.SHEET_DETALLE);
  
  const dataCab = wsAtenciones.getDataRange().getValues();
  
  // Preparar RUN buscado (Solo números)
  let runBuscadoStr = String(run).toUpperCase();
  if (runBuscadoStr.includes("-")) runBuscadoStr = runBuscadoStr.split("-")[0];
  const runBuscadoNum = runBuscadoStr.replace(/[^0-9]/g, '');

  let idEncontrado = null;
  
  // 2. Buscar en historial (De abajo hacia arriba)
  for (let i = dataCab.length - 1; i >= 1; i--) {
    const estado = String(dataCab[i][COL_ATENCIONES.ESTADO - 1]).trim(); 

    let runFilaStr = String(dataCab[i][COL_ATENCIONES.RUN - 1]).toUpperCase();
    if (runFilaStr.includes("-")) runFilaStr = runFilaStr.split("-")[0];
    const runFilaNum = runFilaStr.replace(/[^0-9]/g, '');

    // Aceptamos PENDIENTE o PAGADO
    if (runFilaNum === runBuscadoNum && (estado.includes("PENDIENTE") || estado === "PAGADO")) {
      idEncontrado = dataCab[i][COL_ATENCIONES.ID_ATENCION - 1];
      break; 
    }
  }

  if (!idEncontrado) return null;

  // Recuperar Ítems
  const dataDet = wsDetalle.getDataRange().getValues();
  const itemsRecuperados = [];
  
  for (let j = 1; j < dataDet.length; j++) {
    if (String(dataDet[j][COL_DETALLE.ID_ATENCION - 1]) === String(idEncontrado)) {
      itemsRecuperados.push({
        codigo: dataDet[j][COL_DETALLE.CODIGO - 1],
        nombre: dataDet[j][COL_DETALLE.NOMBRE - 1],
        cantidad: Number(dataDet[j][COL_DETALLE.CANTIDAD - 1])
      });
    }
  }

  return { idAtencion: idEncontrado, items: itemsRecuperados };
}

/**
 * FASE 1: GENERAR PRESUPUESTO (NO LEY - IDA)
 */
function generarPresupuestoBackend(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fechaHoy = new Date();
  const idAtencion = Utilities.getUuid().substring(0, 8);
  const runPaciente = form.run;

  try {
    // 1. PDF (Solo Ambulatorio NO LEY usa presupuesto, así que siempre se genera aquí)
    const folderId = buscarCarpetaEnDrivePorRun(runPaciente) || CONFIG.FOLDER_ID_PDFS;
    
    const template = HtmlService.createTemplateFromFile('Doc_Presupuesto');
    template.datos = { 
      ...form, 
      idAtencion: idAtencion, 
      fecha: fechaHoy, 
      paciente: form.nombre, 
      items: form.carrito 
    };
    
    const blob = Utilities.newBlob(template.evaluate().getContent(), MimeType.HTML).getAs(MimeType.PDF)
                 .setName(`Presupuesto_${runPaciente}.pdf`);
    
    let folderDestino;
    try { folderDestino = DriveApp.getFolderById(folderId); } 
    catch(e) { folderDestino = DriveApp.getFolderById(CONFIG.FOLDER_ID_PDFS); }
    
    const url = folderDestino.createFile(blob).getUrl();

    // 2. Historial
    const wsAtenciones = ss.getSheetByName(CONFIG.SHEET_ATENCIONES);
    wsAtenciones.appendRow([
      idAtencion, 
      fechaHoy, 
      runPaciente, 
      form.nombre,
      form.convenio, 
      form.tipoAtencion, 
      "PENDIENTE PAGO", 
      "",   // Link Entrega (Vacío)
      url,  // Link Cobro
      "",   // Nro CRI (Vacío)
      form.usuario
    ]);

    // 3. Detalle
    const wsDetalle = ss.getSheetByName(CONFIG.SHEET_DETALLE);
    form.carrito.forEach(item => {
      wsDetalle.appendRow([idAtencion, item.codigo, item.nombre, item.cantidad, "PRESUPUESTO"]);
    });

    // 4. Cajas
    const wsReporte = ss.getSheetByName(CONFIG.SHEET_REPORTE_CAJAS);
    let total = 0;
    form.carrito.forEach(i => total += (i.precio || 0) * i.cantidad);
    wsReporte.appendRow([idAtencion, fechaHoy, runPaciente, form.nombre, form.convenio, total, "PENDIENTE PAGO", "", url]);

    return { success: true, url: url };

  } catch (e) { return { success: false, error: e.message }; }
}

/**
 * FASE 2: ENTREGA FINAL (LEY DIRECTA o NO LEY VUELTA)
 */
function confirmarEntregaBackend(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fechaHoy = new Date();
  const idAtencion = form.idAtencionPrevio || Utilities.getUuid().substring(0, 8);
  const runPaciente = form.run || form.rut;

  if (!runPaciente) return { success: false, error: "Error: RUN inválido." };

  try {
    // 1. DESCONTAR STOCK FÍSICO (Siempre se hace)
    form.carrito.forEach(item => {
      if (item.tipo === 'INSUMO') {
        registrarMovimientoStock("SALIDA", {
          codigo: item.codigo, cantidad: item.cantidad,
          runPaciente: runPaciente, nombrePaciente: form.nombre,
          usuarioResponsable: form.usuario, obs: `CRI: ${form.cri || 'N/A'}`
        });
      }
    });

    // 2. GENERAR PDF ENTREGA (SOLO SI ES AMBULATORIO)
    let urlPDF = "";

    // Si es HOSPITALIZADO, no generamos PDF
    if (form.tipoAtencion !== "HOSPITALIZADO") {
        const folderId = buscarCarpetaEnDrivePorRun(runPaciente) || CONFIG.FOLDER_ID_PDFS;
        const pdfBlob = generarPDFEntrega({
          idAtencion: idAtencion, fecha: fechaHoy, paciente: form.nombre,
          run: runPaciente, convenio: form.convenio, atencion: form.tipoAtencion,
          items: form.carrito, funcionario: form.usuario, folderId: folderId
        });
        
        urlPDF = pdfBlob; 
    }

    const wsAtenciones = ss.getSheetByName(CONFIG.SHEET_ATENCIONES);
    const wsDetalle = ss.getSheetByName(CONFIG.SHEET_DETALLE);
    
    // 3. ACTUALIZAR O CREAR REGISTRO CLÍNICO
    if (form.idAtencionPrevio) {
      // FLUJO RECUPERADO (Ambulatorio NO LEY, viene de Presupuesto)
      const data = wsAtenciones.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][COL_ATENCIONES.ID_ATENCION - 1]) === String(idAtencion)) {
          wsAtenciones.getRange(i+1, COL_ATENCIONES.ESTADO).setValue("ENTREGADO"); 
          wsAtenciones.getRange(i+1, COL_ATENCIONES.NRO_CRI).setValue(form.cri);
          wsAtenciones.getRange(i+1, COL_ATENCIONES.LINK_ENTREGA).setValue(urlPDF);
          break;
        }
      }
      
      form.carrito.forEach(item => {
        wsDetalle.appendRow([idAtencion, item.codigo, item.nombre, item.cantidad, "SALIDA"]);
      });

      // Actualizar Reporte Cajas (Cerrar ciclo de pago)
      if (form.cri) {
        const wsRep = ss.getSheetByName(CONFIG.SHEET_REPORTE_CAJAS);
        const dataRep = wsRep.getDataRange().getValues();
        for (let k = 1; k < dataRep.length; k++) {
          if (String(dataRep[k][COL_REPORTE_CAJAS.ID_ATENCION - 1]) === String(idAtencion)) {
             wsRep.getRange(k+1, COL_REPORTE_CAJAS.ESTADO_CRI).setValue("PROCESADO");
             wsRep.getRange(k+1, COL_REPORTE_CAJAS.INPUT_CRI).setValue(form.cri);
             break;
          }
        }
      }

    } else {
      // FLUJO DIRECTO (LEY o Hospitalizado)
      wsAtenciones.appendRow([
        idAtencion, 
        fechaHoy, 
        runPaciente, 
        form.nombre,
        form.convenio, 
        form.tipoAtencion, 
        "ENTREGADO",
        urlPDF, // // Si es Hospitalizado, esto será "" (vacío)
        "", 
        "", 
        form.usuario
      ]);

      form.carrito.forEach(item => {
        wsDetalle.appendRow([idAtencion, item.codigo, item.nombre, item.cantidad, "SALIDA"]);
      });
      
      // REPORTE A CAJAS (Solo si es LEY y no es Hospitalizado)
      if (form.convenio === "LEY" && form.tipoAtencion !== "HOSPITALIZADO") {
         const wsReporte = ss.getSheetByName(CONFIG.SHEET_REPORTE_CAJAS);
         let total = 0; form.carrito.forEach(i => total += (i.precio || 0) * i.cantidad);

         wsReporte.appendRow([
           idAtencion, 
           fechaHoy, 
           runPaciente, 
           form.nombre, 
           form.convenio, 
           total, 
           "PENDIENTE CRI", 
           "", 
           urlPDF
         ]);
      }
    }
    
    // 4. ACTUALIZAR FICHA PACIENTE (Actualizamos fecha aunque no haya PDF)
    actualizarFichaPaciente(runPaciente, fechaHoy, urlPDF);

    return { success: true, url: urlPDF };

  } catch (e) { return { success: false, error: e.message }; }
}

// --- HELPERS ---

function buscarCarpetaEnDrivePorRun(run) {
  try {
    const runLimpio = String(run).split('-')[0].trim();
    if (!runLimpio) return null;
    const query = `title contains '${runLimpio}' and '${CONFIG.FOLDER_ID_PACIENTES}' in parents and trashed = false`;
    const folders = DriveApp.searchFolders(query);
    if (folders.hasNext()) return folders.next().getId();
  } catch (e) { console.warn(e.message); }
  return null;
}

function actualizarFichaPaciente(run, fecha, link) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(CONFIG.SHEET_PACIENTES);
  const data = ws.getDataRange().getValues();
  const runBuscado = String(run).split('-')[0].trim();

  for(let i=1; i<data.length; i++) {
    const runEnFila = String(data[i][COL_PACIENTES.RUN - 1]).trim();
    if(runEnFila === runBuscado) {
       ws.getRange(i+1, COL_PACIENTES.FECHA_ATENCION).setValue(fecha);
       if (link) { 
          ws.getRange(i+1, COL_PACIENTES.LINK_ULTIMO_DOC).setValue(link);
       }
       return true;
    }
  }
  return false;
}

function generarPDFEntrega(datos) {
  const template = HtmlService.createTemplateFromFile('Doc_Entrega');
  template.datos = datos;
  const html = template.evaluate().getContent();
  const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF)
               .setName(`Entrega_${datos.run}_${datos.idAtencion}.pdf`);
  
  let folder;
  if (datos.folderId) {
    try { folder = DriveApp.getFolderById(datos.folderId); } 
    catch(e) { folder = DriveApp.getFolderById(CONFIG.FOLDER_ID_PDFS); }
  } else {
    folder = DriveApp.getFolderById(CONFIG.FOLDER_ID_PDFS);
  }
  return folder.createFile(blob).getUrl();
}