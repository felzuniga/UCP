<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light p-4">

  <div class="mb-3">
    <label class="form-label fw-bold">Ingrese RUN del paciente (Sin DV ni guión):</label>
    <div class="input-group">
      <input type="text" id="txtRun" class="form-control" placeholder="Ej: 12345678" 
             onkeypress="if(event.keyCode==13) buscar()" 
             oninput="this.value = this.value.replace(/[^0-9]/g, '')" maxlength="8">
      <button class="btn btn-primary" onclick="buscar()" id="btnBuscar">Buscar</button>
    </div>
  </div>

  <div id="resultado" class="mt-4" style="display:none;"></div>

  <script>
    function buscar() {
      const run = document.getElementById('txtRun').value.trim();
      if(!run) return;

      document.getElementById('btnBuscar').disabled = true;
      document.getElementById('resultado').style.display = 'block';
      document.getElementById('resultado').innerHTML = '<div class="text-center text-muted">Buscando...</div>';

      google.script.run.withSuccessHandler(res => {
        document.getElementById('btnBuscar').disabled = false;
        const div = document.getElementById('resultado');
        const runBuscado = document.getElementById('txtRun').value; // Capturamos el RUN limpio para enviarlo

        if(res.encontrado) {
          div.innerHTML = `
            <div class="alert alert-success p-3 border border-success">
              <h6 class="fw-bold mb-1">${res.nombre}</h6>
              <p class="mb-3 small text-dark">RUN: ${res.runCompleto} | Convenio: ${res.convenio}</p>
              <div class="d-grid gap-2">
                <button class="btn btn-primary btn-sm fw-bold" onclick="abrirModulo('mostrarModalAtencion', '${runBuscado}')">📝 Registrar Atención</button>
                <button class="btn btn-outline-secondary btn-sm" onclick="abrirModulo('mostrarSidebarEditarPaciente', '${runBuscado}')">✏️ Editar Paciente</button>
              </div>
            </div>`;
        } else {
          div.innerHTML = `
            <div class="alert alert-warning p-3 border border-warning">
              <h6 class="fw-bold text-danger">Paciente no encontrado</h6>
              <p class="small mb-3">El RUN ingresado no está registrado en el sistema.</p>
              <button class="btn btn-success w-100 fw-bold" onclick="abrirModulo('mostrarSidebarPacientes')">👤 Registrar Nuevo Paciente</button>
            </div>`;
        }
      }).buscarPacienteBackend(run);
    }

    // Función actualizada que recibe el nombre del script a ejecutar y el RUN opcional
    function abrirModulo(funcionScript, runParametro) {
      if (runParametro) {
        // Ejecuta el modal en Apps Script inyectándole el RUN
        google.script.run[funcionScript](runParametro);
      } else {
        // Ejecuta el modal normalmente (Ej: Nuevo paciente)
        google.script.run[funcionScript]();
      }
      // Cierra este modal de búsqueda
      google.script.host.close();
    }
  </script>
</body>
</html>
