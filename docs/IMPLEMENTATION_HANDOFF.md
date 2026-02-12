# Webapp 測試/重構交付索引（不含實作）

這份 repo 目前需要兩件事：

1) 針對 webapp 各模組補齊測試（尤其是 API contract / pagination 的 regression）
2) 抽出可重複用的 hook/context/component/lib，降低重複代碼與不一致

請以以下文件作為唯一規格來源：

- 測試計畫：`docs/testing/WEBAPP_MODULE_TEST_PLAN.md`
- 重複代碼整合藍圖：`docs/refactor/WEBAPP_REUSE_BLUEPRINT.md`
- API contracts（client/server 對齊）：`docs/api/WEBAPP_API_CONTRACTS.md`

建議實作順序（避免邊做邊壞）：

1) 先補 tests 把 contract 釘住（votes、posts pagination）
2) 再做抽象與遷移（先 votes、再 notifications、再 posts pagination）

既有參考文件：

- `docs/login-flow.md`
- `docs/registration-flow.md`
- `docs/storage-testing.md`
- `docs/username-validation.md`
