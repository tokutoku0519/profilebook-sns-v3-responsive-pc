-- ============================================================
-- 【読み取りだけ・本番でも検証用でも実行できる】0001・0002 の適用前に、
-- いまの方針の穴を使って作られたかもしれないデータがないかを一覧にする（何も書きかえない）
--
-- 使い方：SQL Editor に全文を貼って Run。結果の表（check・n・detail）を見る。
--   n が 0 なら、その種類のデータはない。1 以上なら detail（だれ・どのサークル）を見て、
--   本当に正しく承認・参加したものかを確かめる（自動では消さない。消すかどうかはオーナーが決める）
-- 注意：「承認済みのメンバー」が正規に承認されたのか、API で承認を回避したのかは、記録からは区別できない。
--       承認制のサークルの承認済みメンバーを全員並べるので、作成者として承認した覚えがあるかで判断する。
-- ============================================================
with
appr as (   -- 1. 承認制のサークルの、作成者以外の承認済みメンバー（承認を回避した可能性のある人を含む）
  select c.name as circle, p.username, m.created_at
    from public.circle_members m
    join public.circles c on c.id = m.circle_id
    left join public.profiles p on p.id = m.user_id
   where coalesce(c.join_policy, 'open') = 'approval'
     and coalesce(m.status, 'member') = 'member'
     and m.user_id <> c.created_by
),
fol as (    -- 2. フォロワー限定のサークルに、作成者をフォローしていない人が参加している（見えないはずのサークルに参加）
  select c.name as circle, p.username, coalesce(m.status, 'member') as status
    from public.circle_members m
    join public.circles c on c.id = m.circle_id
    left join public.profiles p on p.id = m.user_id
   where coalesce(c.visibility, 'public') = 'followers'
     and m.user_id <> c.created_by
     and not exists (select 1 from public.follows f where f.follower_id = m.user_id and f.following_id = c.created_by)
),
rep as (    -- 3. メンバーでない人（申請中を含む）の返信
  select c.name as circle, p.username
    from public.circle_replies r
    join public.circle_posts po on po.id = r.post_id
    join public.circles c on c.id = po.circle_id
    left join public.profiles p on p.id = r.user_id
   where not exists (select 1 from public.circle_members m
                      where m.circle_id = po.circle_id and m.user_id = r.user_id and coalesce(m.status, 'member') = 'member')
),
pst as (    -- 4. 承認済みメンバーでない人（申請中など）の投稿
  select c.name as circle, p.username
    from public.circle_posts po
    join public.circles c on c.id = po.circle_id
    left join public.profiles p on p.id = po.user_id
   where not exists (select 1 from public.circle_members m
                      where m.circle_id = po.circle_id and m.user_id = po.user_id and coalesce(m.status, 'member') = 'member')
),
vot as (    -- 5. メンバーでない人による投票・メンバーでない人への投票
  select c.name as circle, p.username as voter, t.username as target
    from public.circle_votes v
    join public.circle_posts po on po.id = v.post_id
    join public.circles c on c.id = po.circle_id
    left join public.profiles p on p.id = v.user_id
    left join public.profiles t on t.id = v.target_id
   where not exists (select 1 from public.circle_members m where m.circle_id = po.circle_id and m.user_id = v.user_id and coalesce(m.status, 'member') = 'member')
      or not exists (select 1 from public.circle_members m where m.circle_id = po.circle_id and m.user_id = v.target_id and coalesce(m.status, 'member') = 'member')
),
off as (    -- 6. 公認アカウントでない人が作った公認のサークル
  select c.name as circle, p.username
    from public.circles c
    left join public.profiles p on p.id = c.created_by
   where coalesce(c.is_official, false) and not coalesce(p.is_official, false)
),
com as (    -- 7. 読めないはずの回答（フォロワー限定・非公開）に、ほかの人が付けたコメント・リアクション
  select a.visibility, p.username, 'comment' as kind
    from public.comments x join public.answers a on a.id = x.answer_id left join public.profiles p on p.id = x.user_id
   where x.user_id <> a.user_id and (a.visibility = 'private'
      or (a.visibility = 'followers' and not exists (select 1 from public.follows f where f.follower_id = x.user_id and f.following_id = a.user_id)))
  union all
  select a.visibility, p.username, 'reaction'
    from public.reactions x join public.answers a on a.id = x.answer_id left join public.profiles p on p.id = x.user_id
   where x.user_id <> a.user_id and (a.visibility = 'private'
      or (a.visibility = 'followers' and not exists (select 1 from public.follows f where f.follower_id = x.user_id and f.following_id = a.user_id)))
)
select '1. 承認制サークルの承認済みメンバー（作成者以外）：承認した覚えがあるか確認' as check_name, count(*) as n,
       coalesce(string_agg(format('%s：@%s（%s）', circle, username, to_char(created_at, 'YYYY-MM-DD')), ' / '), '') as detail from appr
union all select '2. フォロワー限定サークルに、作成者をフォローしていない参加者', count(*), coalesce(string_agg(format('%s：@%s（%s）', circle, username, status), ' / '), '') from fol
union all select '3. メンバーでない人の返信', count(*), coalesce(string_agg(format('%s：@%s', circle, username), ' / '), '') from rep
union all select '4. 承認済みメンバーでない人の投稿', count(*), coalesce(string_agg(format('%s：@%s', circle, username), ' / '), '') from pst
union all select '5. メンバーでない人の投票・メンバーでない人への投票', count(*), coalesce(string_agg(format('%s：@%s→@%s', circle, voter, target), ' / '), '') from vot
union all select '6. 公認でない人が作った公認サークル', count(*), coalesce(string_agg(format('%s：@%s', circle, username), ' / '), '') from off
union all select '7. 読めないはずの回答への、ほかの人のコメント・リアクション', count(*), coalesce(string_agg(format('%s（%s）：@%s', kind, visibility, username), ' / '), '') from com;
