# Provider UI 验收清单

## 1. Provider 选择
- [ ] Provider 下拉分组正确
- [ ] Planned provider 不会混入主列表
- [ ] 切换 provider 后 model 自动切换到有效模型

## 2. Provider 概览
- [ ] label / description / recommendedFor 正确展示
- [ ] docs 链接可点击
- [ ] group / maturity / capability badge 正确显示

## 3. 连接配置
- [ ] API key 输入框 placeholder 正确
- [ ] Base URL 展示逻辑正确（本地/企业/云端）
- [ ] 切换 provider 后 Provider Test 状态被重置
- [ ] Test Provider Connection 三态正确显示

## 4. 模型卡片
- [ ] 模型描述/推荐用途/上下文/价格展示正确
- [ ] model-level capabilities 正确展示
- [ ] 切换模型后卡片同步更新

## 5. 高级配置
- [ ] 开启 Use different models for Plan and Act 后展示两个卡片
- [ ] Plan / Act Provider 与 Model 下拉联动正确
- [ ] 顶部 ChatArea 摘要与设置一致

## 6. 校验提示
- [ ] 缺失 deployment / baseUrl 等错误会阻止保存
- [ ] warning 只提醒不阻止保存
- [ ] provider-specific fields 切换不串值

## 7. 构建与回归
- [ ] `npm run check:providers` 通过
- [ ] `npm --prefix webui run build` 通过
