-- ============================================================
-- 设置管理员脚本
-- 用法：修改下面的变量，然后在 Supabase Dashboard → SQL Editor 执行
-- ============================================================

-- 步骤 1：设置要分配为管理员的 username
-- 将此值改为目标用户的 username
SET app.username_to_promote = 'test';

-- 步骤 2：设置角色类型
-- 可选值：'admin' 或 'super_admin'
SET app.admin_role = 'super_admin';

-- ============================================================
-- 以下代码自动执行，无需修改
-- ============================================================

DO $$
DECLARE
  v_username TEXT;
  v_role TEXT;
  v_user_id UUID;
BEGIN
  -- 获取设置值
  v_username := current_setting('app.username_to_promote', true);
  v_role := current_setting('app.admin_role', true);
  
  -- 验证输入
  IF v_username IS NULL OR v_username = '' THEN
    RAISE EXCEPTION '错误：请在第 8 行设置 username';
  END IF;
  
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION '错误：角色必须是 admin 或 super_admin';
  END IF;
  
  -- 查找用户
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE username = v_username;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '错误：找不到 username 为 "%" 的用户', v_username;
  END IF;
  
  -- 插入或更新管理员记录
  INSERT INTO public.admin_users (user_id, role)
  VALUES (v_user_id, v_role)
  ON CONFLICT (user_id) DO UPDATE
  SET role = v_role;
  
  RAISE NOTICE '成功：用户 % (%) 已被设置为 %', v_username, v_user_id, v_role;
END $$;

-- 验证结果
SELECT 
  p.username,
  p.display_name,
  au.role as admin_role,
  p.created_at
FROM public.profiles p
JOIN public.admin_users au ON p.user_id = au.user_id
WHERE p.username = current_setting('app.username_to_promote', true);
