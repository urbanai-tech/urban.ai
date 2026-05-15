# Relatorio de Fluxos Controlados

Gerado em: 2026-05-15T13:55:18.866Z
API: https://urbanai-production-85fd.up.railway.app
Usuario: gustavo8gouveia@hotmail.com

| Fluxo | Status | Resultado | Resumo |
|---|---:|---|---|
| login | 201 | OK | "object(accessToken)" |
| properties.list | 200 | OK | "array(9)" |
| pricing.history.before | 200 | OK | "array(1)" |
| pricing.patch.smoke | 200 | OK | {"addressId":"1a4e0b1a-fc66-43be-b35a-529ade42a641","listId":"83a7a51a-9036-47f4-8791-ebdc78d83023","manualDailyPrice":151,"averageMonthlyRevenue":4500,"dailyPrice":151,"pricingInputSource":"manual","pricingInputsUpdatedAt":"2026-05-15T13:55:13.371Z"} |
| pricing.patch.rollback | 200 | OK | {"addressId":"1a4e0b1a-fc66-43be-b35a-529ade42a641","listId":"83a7a51a-9036-47f4-8791-ebdc78d83023","manualDailyPrice":150,"averageMonthlyRevenue":4500,"dailyPrice":150,"pricingInputSource":"manual","pricingInputsUpdatedAt":"2026-05-15T13:55:13.680Z"} |
| pricing.history.after | 200 | OK | "array(3)" |
| admin.alpha.reprocess | 400 | FALHA | "object(message,error,statusCode)" |
| admin.alpha.recommendations | 200 | OK | "object(generatedAt,user,total,rows)" |
| suggestion.mutation | - | FALHA | no recommendation id found in admin alpha recommendations |
| roi.me.after | 200 | OK | "object(windowDays,generatedAt,user,subscription,money,activity,dataQuality,perProperty,recentWins)" |
| billing.quota | 200 | OK | {"contratados":30,"ativos":9,"podeAdicionar":true} |
| billing.subscription | 200 | OK | {"id":"alpha-24d09b73-6532-4aa6-8ede-36a0dd7ea634","status":"trialing","currency":"brl","start_date":1778853315,"metadata":{"urbanai_plan":"alpha","urbanai_quantity":"30","urbanai_billing_cycle":"monthly"},"plan":{"id":"alpha","amount":0,"currency":"brl","interval":"monthly"}} |
| stripe.sync_check | 200 | OK | {"total":8,"ok":4,"missing":4,"notConfigured":0,"problems":0,"stripeKeyConfigured":true} |
| stripe.checkout_session_create_no_charge | 201 | OK | {"sessionIdPrefix":"cs_test_a1K7"} |
| stays.admin_health | 200 | OK | {"apiBaseConfigured":false,"tokenEncryptionConfigured":false,"betaPrivate":true,"missingEnv":["STAYS_API_BASE_URL","STAYS_TOKEN_ENCRYPTION_KEY"]} |
| stays.listings | 200 | OK | "array(0)" |
| stays.push.rollback | - | SKIP | no sandbox/listing available or Stays still beta private |
