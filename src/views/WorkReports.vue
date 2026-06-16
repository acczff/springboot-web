<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { workorderApi } from '../api/workorder'
import { workreportApi } from '../api/workreport'

const pageNum = ref(1)      // 当前第几页
const pageSize = ref(10)    // 每页几条
const total = ref(0)        // 总条数（从后端拿到后存起来）


const inProgressOrders = ref<any[]>([])   // IN_PROGRESS 工单列表
const myReports = ref<any[]>([])          // 我的报工记录
const pendingReviews = ref<any[]>([])     // 待审核列表

const showCreateDialog = ref(false)
const selectedWorkOrderId = ref<number | null>(null)  // 点哪行带入
const selectedOrderItems = ref<any[]>([])              // 弹窗里展示的 items 明细
const itemQtys = ref<number[]>([])                     // 每个产品对应的报工数量

const rejectDialogId = ref<number | null>(null)  // 当前驳回的报工ID
const rejectReason = ref('')             // 驳回原因

onMounted(() => {
    fetchInProgressOrders()
    fetchMyReports()
    fetchPendingReviews()
})

// 获取 IN_PROGRESS 工单列表
const fetchInProgressOrders = async () => {
    try {
        const res: any = await workorderApi.getWorkOrdersList(pageNum.value, pageSize.value, 'IN_PROGRESS')
        inProgressOrders.value = res.list
        total.value = res.total
    } catch (error) {
        console.error('获取工单列表失败:', error)
    }
}

// 获取我的报工记录
const fetchMyReports = async () => {
    try {
        const res: any = await workreportApi.getMyReports(pageNum.value, pageSize.value)
        myReports.value = res.list
    } catch (error) {
        console.error('获取我的报工记录失败:', error)
    }
}

// 获取待审核的报工记录列表
const fetchPendingReviews = async () => {
    try {
        const res: any = await workreportApi.getPendingReview(pageNum.value, pageSize.value)
        pendingReviews.value = res.list
    } catch (error) {
        console.error('获取待审核的报工记录失败:', error)
    }
}

const openCreateDialog = async (workOrderId: number) => {
    selectedWorkOrderId.value = workOrderId
    selectedOrderItems.value = []
    itemQtys.value = []
    showCreateDialog.value = true
    const detail: any = await workorderApi.getWorkOrderDetails(workOrderId)
    selectedOrderItems.value = detail.items || []
    itemQtys.value = selectedOrderItems.value.map(() => 0)
}

const submitCreate = async () => {
    const hasQty = itemQtys.value.some(q => q > 0)
    if (!hasQty) {
        alert('请至少为一个产品填写报工数量')
        return
    }
    for (let i = 0; i < selectedOrderItems.value.length; i++) {
        const qty = itemQtys.value[i]
        if (!qty || qty <= 0) continue
        const item = selectedOrderItems.value[i]
        // 前端防御：已完成的产品跳过
        if (item.completedQty >= item.plannedQty) continue
        // 前端防御：不允许超出剩余量
        const remaining = item.plannedQty - item.completedQty
        if (qty > remaining) {
            alert(`产品【${item.product?.name}】剩余计划量为 ${remaining}，不能报工 ${qty}`)
            return
        }
        await workreportApi.createReport(
            selectedWorkOrderId.value!,
            qty,
            item.id,
            item.product?.name
        )
    }
    showCreateDialog.value = false
    fetchMyReports()
}

const submitReport = async (id: number) => {
    await workreportApi.submitReport(id)
    fetchMyReports()
}

const approveReport = async (id: number) => {
    await workreportApi.approveReport(id)
    fetchPendingReviews()
}

const openRejectDialog = (id: number) => {
    rejectDialogId.value = id
    rejectReason.value = ''
}

const confirmReject = async () => {
    if (!rejectReason.value.trim()) {
        alert('请填写驳回原因')
        return
    }
    await workreportApi.rejectReport(rejectDialogId.value!, rejectReason.value)
    rejectDialogId.value = null
    fetchPendingReviews()
}


</script>

<template>
    <div class="page">
        <div class="page-header">
            <h2 class="page-title">报工管理</h2>
        </div>

        <!-- 第一块：可报工的工单（IN_PROGRESS） -->
        <section class="card">
            <h3 class="section-title">可报工的工单</h3>
            <div class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>工单名称</th>
                            <th>状态</th>
                            <th>创建人</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="order in inProgressOrders" :key="order.id">
                            <td>{{ order.id }}</td>
                            <td>{{ order.name }}</td>
                            <td><span :class="'status-badge status-' + order.status.toLowerCase()">{{ order.status
                            }}</span></td>
                            <td>{{ order.createdByName }}</td>
                            <td><button class="btn-action btn-start" @click="openCreateDialog(order.id)">新建报工</button>
                            </td>
                        </tr>
                        <tr v-if="inProgressOrders.length === 0">
                            <td colspan="5" class="empty-tip">暂无可报工的工单</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- 第二块：我的报工记录 -->
        <section class="card">
            <h3 class="section-title">我的报工记录</h3>
            <div class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>关联工单</th>
                            <th>报工数量</th>
                            <th>状态</th>
                            <th>报工时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="report in myReports" :key="report.id">
                            <td>{{ report.id }}</td>
                            <td>{{ report.workOrderId }}</td>
                            <td>{{ report.reportedQty }}</td>
                            <td><span :class="'status-badge status-' + report.status.toLowerCase()">{{ report.status
                            }}</span></td>
                            <td>{{ report.reportedTime ? new Date(report.reportedTime).toLocaleString() : '-' }}</td>
                            <td>
                                <button v-if="report.status === 'DRAFT'" class="btn-action btn-issue"
                                    @click="submitReport(report.id)">提交审核</button>
                                <span v-else class="no-action">—</span>
                            </td>
                        </tr>
                        <tr v-if="myReports.length === 0">
                            <td colspan="6" class="empty-tip">暂无报工记录</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- 第三块：待审核（质检视角） -->
        <section class="card">
            <h3 class="section-title">待审核报工</h3>
            <div class="table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>报工人</th>
                            <th>报工数量</th>
                            <th>工单ID</th>
                            <th>报工时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="report in pendingReviews" :key="report.id">
                            <td>{{ report.id }}</td>
                            <td>{{ report.reportedByName }}</td>
                            <td>{{ report.reportedQty }}</td>
                            <td>{{ report.workOrderId }}</td>
                            <td>{{ report.reportedTime ? new Date(report.reportedTime).toLocaleString() : '-' }}</td>
                            <td class="action-cell">
                                <button class="btn-action btn-complete" @click="approveReport(report.id)">通过</button>
                                <button class="btn-action btn-cancel" @click="openRejectDialog(report.id)">驳回</button>
                            </td>
                        </tr>
                        <tr v-if="pendingReviews.length === 0">
                            <td colspan="6" class="empty-tip">暂无待审核记录</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- 新建报工弹窗 -->
        <div v-if="showCreateDialog" class="dialog-mask">
            <div class="dialog">
                <div class="dialog-header">
                    <h3 class="dialog-title">新建报工</h3>
                    <button class="dialog-close" @click="showCreateDialog = false">✕</button>
                </div>
                <div class="form-item">
                    <label>关联工单 ID</label>
                    <input :value="selectedWorkOrderId" disabled />
                </div>
                <div class="form-item">
                    <label>各产品报工数量</label>
                    <table class="items-table">
                        <thead><tr><th>产品名称</th><th>计划数量</th><th>已完成</th><th>本次报工</th></tr></thead>
                        <tbody>
                            <tr v-for="(item, i) in selectedOrderItems" :key="i">
                                <td>{{ item.product?.name || '-' }}</td>
                                <td>{{ item.plannedQty }}</td>
                                <td>{{ item.completedQty }}</td>
                                <td>
                                    <span v-if="item.completedQty >= item.plannedQty" class="done-badge">已完成</span>
                                    <input v-else v-model.number="itemQtys[i]" type="number" min="0"
                                        :max="item.plannedQty - item.completedQty"
                                        style="width:70px;padding:3px 6px;border:1px solid #d9d9d9;border-radius:4px;" />
                                </td>
                            </tr>
                            <tr v-if="selectedOrderItems.length === 0">
                                <td colspan="4" style="text-align:center;color:#999">加载中...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-default" @click="showCreateDialog = false">取消</button>
                    <button class="btn btn-primary" @click="submitCreate">提交</button>
                </div>
            </div>
        </div>

        <!-- 驳回弹窗 -->
        <div v-if="rejectDialogId !== null" class="dialog-mask">
            <div class="dialog">
                <div class="dialog-header">
                    <h3 class="dialog-title">驳回报工 #{{ rejectDialogId }}</h3>
                    <button class="dialog-close" @click="rejectDialogId = null">✕</button>
                </div>
                <div class="form-item">
                    <label>驳回原因</label>
                    <textarea v-model="rejectReason" rows="3" placeholder="请填写驳回原因（必填）"></textarea>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-default" @click="rejectDialogId = null">取消</button>
                    <button class="btn btn-cancel-solid" @click="confirmReject">确认驳回</button>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
.page {
    padding: 24px;
}

.page-header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
}

.page-title {
    margin: 0;
    font-size: 20px;
}

.card {
    background: #fff;
    border-radius: 6px;
    padding: 16px 20px;
    margin-bottom: 20px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.section-title {
    font-size: 15px;
    font-weight: 600;
    color: #333;
    margin: 0 0 12px;
    padding-left: 8px;
    border-left: 3px solid #1677ff;
}

.table-wrapper {
    overflow-x: auto;
}

.table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}

.table th,
.table td {
    padding: 10px 12px;
    border: 1px solid #e8e8e8;
    text-align: left;
}

.table thead tr {
    background: #fafafa;
    font-weight: 600;
}

.table tbody tr:hover {
    background: #f5f5f5;
}

.empty-tip {
    text-align: center;
    color: #999;
    padding: 20px;
}

.no-action {
    color: #ccc;
}

/* 状态徽章 */
.status-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
}

.status-draft {
    background: #f5f5f5;
    color: #595959;
    border: 1px solid #d9d9d9;
}

.status-issued {
    background: #e6f4ff;
    color: #1677ff;
    border: 1px solid #91caff;
}

.status-in_progress {
    background: #fff7e6;
    color: #d46b08;
    border: 1px solid #ffd591;
}

.status-completed {
    background: #f6ffed;
    color: #389e0d;
    border: 1px solid #b7eb8f;
}

.status-cancelled {
    background: #fff1f0;
    color: #cf1322;
    border: 1px solid #ffa39e;
}

.status-submitted {
    background: #e6f4ff;
    color: #1677ff;
    border: 1px solid #91caff;
}

.status-approved {
    background: #f6ffed;
    color: #389e0d;
    border: 1px solid #b7eb8f;
}

.status-rejected {
    background: #fff1f0;
    color: #cf1322;
    border: 1px solid #ffa39e;
}

/* 操作按钮 */
.action-cell {
    display: flex;
    gap: 6px;
    align-items: center;
}

.btn-action {
    padding: 3px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
}

.btn-issue {
    background: #e6f4ff;
    color: #1677ff;
    border: 1px solid #91caff;
}

.btn-issue:hover {
    background: #bae0ff;
}

.btn-start {
    background: #fff7e6;
    color: #d46b08;
    border: 1px solid #ffd591;
}

.btn-start:hover {
    background: #ffe7ba;
}

.btn-complete {
    background: #f6ffed;
    color: #389e0d;
    border: 1px solid #b7eb8f;
}

.btn-complete:hover {
    background: #d9f7be;
}

.btn-cancel {
    background: #fff1f0;
    color: #cf1322;
    border: 1px solid #ffa39e;
}

.btn-cancel:hover {
    background: #ffccc7;
}

/* 弹窗 */
.dialog-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.dialog {
    background: #fff;
    border-radius: 8px;
    width: 420px;
    max-width: 95vw;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;
}

.dialog-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.dialog-close {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: #999;
}

.dialog-close:hover {
    color: #333;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid #f0f0f0;
}

.form-item {
    padding: 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-item label {
    font-size: 13px;
    color: #666;
}

.form-item input,
.form-item textarea {
    padding: 8px 10px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
}

.form-item input:focus,
.form-item textarea:focus {
    outline: none;
    border-color: #1677ff;
}

.form-item input:disabled {
    background: #f5f5f5;
    color: #999;
}

.items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.items-table th, .items-table td { padding: 6px 8px; border: 1px solid #e8e8e8; text-align: left; }
.items-table thead tr { background: #fafafa; font-weight: 600; }
.done-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; font-size: 12px; }

.btn {
    padding: 6px 16px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 14px;
}

.btn-primary {
    background: #1677ff;
    color: #fff;
}

.btn-primary:hover {
    background: #4096ff;
}

.btn-default {
    background: #fff;
    color: #333;
    border: 1px solid #d9d9d9;
}

.btn-default:hover {
    border-color: #1677ff;
    color: #1677ff;
}

.btn-cancel-solid {
    background: #ff4d4f;
    color: #fff;
    border: none;
    padding: 6px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.btn-cancel-solid:hover {
    background: #ff7875;
}
</style>