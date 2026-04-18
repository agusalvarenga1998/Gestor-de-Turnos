// Logger de solicitudes HTTP
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusColor = statusCode >= 400 ? '❌' : '✓';

    console.log(
      `${statusColor} [${new Date().toISOString()}] ${req.method} ${req.path} - ${statusCode} (${duration}ms)`
    );
  });

  next();
};
