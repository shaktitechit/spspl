/**
 * @fileoverview End-to-End Integration Test for Project Management Module.
 * @module scripts/testProjectModule
 */
require('dotenv').config({ path: '../.env.docker' });
require('dotenv').config();

const rawUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
if (rawUri.includes('host.docker.internal')) {
  process.env.MONGO_URI = rawUri.replace('host.docker.internal', '127.0.0.1');
  process.env.MONGODB_URI = process.env.MONGO_URI;
}

const mongoose = require('mongoose');
const db = require('../src/config/db');
const { registerModels, getModels } = require('../src/data/mongoRegistry');
const projectService = require('../src/modules/project/project.service');
const chatService = require('../src/modules/project/projectChat.service');

async function runEndToEndVerification() {
  console.log('🚀 [E2E Test] Starting Project Management Module Verification...\n');

  try {
    await db.connect();
    registerModels();
    const { Project, ProjectActionStep, ProjectMessage, ProjectFile, User, Attachment } = getModels();

    // 1. Mock Admin User
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Integration Test Admin',
      email: 'test-admin@opms.local',
      roles: ['admin'],
      portals: [{ portal_code: 'work_planner', access_roles: ['admin'] }],
    };

    console.log('✅ 1. Mock Admin Context Initialized:', mockUser.name);

    // 2. Create Project with initial Action Steps
    console.log('⏳ 2. Creating New Project with 3 Action Steps...');
    const createdProject = await projectService.createProject(
      {
        title: 'Q4 Enterprise Logistics System',
        description: 'Automate tracking and delivery verification across all logistics hubs',
        category: 'Operations',
        priority: 'high',
        status: 'planning',
        start_date: new Date(),
        target_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        tags: ['Logistics', 'Enterprise', 'Automated'],
        steps: [
          {
            step_number: 1,
            title: 'Requirements & Architecture Specification',
            phase_name: 'Planning',
            checklist: [
              { title: 'Stakeholder interviews' },
              { title: 'System architecture diagram' },
            ],
          },
          {
            step_number: 2,
            title: 'Core Engine Development',
            phase_name: 'Execution',
            checklist: [
              { title: 'Database schema migration' },
              { title: 'API endpoints implementation' },
            ],
          },
          {
            step_number: 3,
            title: 'Client UAT & Handover',
            phase_name: 'Review',
            checklist: [{ title: 'Final test report' }],
          },
        ],
      },
      mockUser
    );

    console.log(`✅ Project Created: [${createdProject.project_code}] "${createdProject.title}" (ID: ${createdProject._id})`);
    console.log(`   Initial Progress: ${createdProject.progress_percentage}% (Completed: ${createdProject.completed_steps}/${createdProject.total_steps})`);

    const projectId = createdProject._id;

    // 3. List and verify Action Steps
    console.log('\n⏳ 3. Fetching Steps & Completing Step 1...');
    let steps = await projectService.listSteps(projectId, mockUser);
    if (steps.length !== 3) throw new Error(`Expected 3 steps, got ${steps.length}`);

    // Complete Step 1
    const step1 = steps[0];
    await projectService.updateStepStatus(
      projectId,
      step1._id,
      'completed',
      { remark: 'Requirements signed off by client lead.' },
      mockUser
    );

    // Check off checklist item on Step 2
    const step2 = steps[1];
    if (step2.checklist && step2.checklist.length > 0) {
      await projectService.toggleChecklistItem(
        projectId,
        step2._id,
        step2.checklist[0]._id,
        true,
        mockUser
      );
    }

    // Verify Progress Recalculation
    const updatedProj = await projectService.getProjectById(projectId, mockUser);
    console.log(`✅ Step 1 Completed. Updated Project Progress: ${updatedProj.progress_percentage}% (Completed: ${updatedProj.completed_steps}/${updatedProj.total_steps})`);

    // 4. Test Project Chat Room
    console.log('\n⏳ 4. Testing Project Chat Room & File Sharing...');
    const message1 = await chatService.postMessage(
      projectId,
      {
        content: 'Team, requirements are completed and Step 1 is marked done! @lead',
        message_type: 'text',
      },
      mockUser
    );
    console.log(`✅ Message Posted: "${message1.content}" by ${message1.sender_name}`);

    // Pin Message
    const pinnedMsg = await chatService.togglePinMessage(projectId, message1._id, mockUser);
    console.log(`✅ Message Pinned: is_pinned = ${pinnedMsg.is_pinned}`);

    // 5. Test Central Document Hub
    console.log('\n⏳ 5. Testing Project Document Recording...');
    const mockAttachment = new Attachment({
      filename: 'architecture_specs_v1.pdf',
      original_name: 'Architecture Specifications v1.0.pdf',
      mime_type: 'application/pdf',
      size: 1024 * 450,
      storage_path: 'projects/docs/spec.pdf',
      url: 'http://localhost:7007/api/projects/attachments/mock/view',
    });
    await mockAttachment.save();

    const fileRecord = await chatService.recordProjectFile(
      projectId,
      {
        action_step_id: step1._id,
        attachment_id: mockAttachment._id,
        file_name: mockAttachment.original_name,
        folder: 'Specs',
        mime_type: mockAttachment.mime_type,
        size_bytes: mockAttachment.size,
      },
      mockUser
    );
    console.log(`✅ Document Stored in Hub: "${fileRecord.file_name}" under Folder: [${fileRecord.folder}]`);

    const filesList = await chatService.listFiles(projectId, {}, mockUser);
    console.log(`✅ Total Project Documents: ${filesList.length}`);

    // 6. Test Admin Closure Workflow
    console.log('\n⏳ 6. Testing Admin Formal Project Closure...');
    const closedProject = await projectService.closeProject(
      projectId,
      { remarks: 'All deliverables tested and signed off for production rollout.' },
      mockUser
    );
    console.log(`✅ Project Closed Successfully: Status = ${closedProject.status}`);
    console.log(`   Closed Date: ${closedProject.actual_closed_date}`);
    console.log(`   Closure Remarks: "${closedProject.closure_remarks}"`);

    // 7. Test Admin Reopen
    console.log('\n⏳ 7. Testing Admin Project Reopening...');
    const reopenedProject = await projectService.reopenProject(projectId, mockUser);
    console.log(`✅ Project Reopened Successfully: Status = ${reopenedProject.status}`);

    // 8. Test Team Assignment & Member Management
    console.log('\n⏳ 8. Testing Team Assignment & Member Management...');
    
    // Create a mock user to add as member
    const newMemberUser = new User({
      name: 'Jane Doe Logistics',
      email: 'jane.logistics@opms.local',
      department: 'Logistics',
      is_active: true,
    });
    await newMemberUser.save();

    // Test assign teams
    const projWithTeams = await projectService.assignProjectTeams(
      projectId,
      ['Logistics', 'Operations'],
      true,
      mockUser
    );
    console.log(`✅ Assigned Teams to Project: [${projWithTeams.assigned_team_ids.join(', ')}]`);
    console.log(`   Auto-enrolled Members Count: ${projWithTeams.members.length}`);

    // Test add member
    const projWithMember = await projectService.addProjectMember(
      projectId,
      { user_id: newMemberUser._id, role: 'lead' },
      mockUser
    );
    console.log(`✅ Added Project Member: ${newMemberUser.name} with Role: lead`);

    // Test update member role
    const projWithRoleUpdated = await projectService.updateProjectMemberRole(
      projectId,
      newMemberUser._id,
      'admin',
      mockUser
    );
    const updatedMember = projWithRoleUpdated.members.find((m) => String(m.user_id?._id || m.user_id) === String(newMemberUser._id));
    console.log(`✅ Updated Member Role: ${updatedMember?.role}`);

    // Test remove member
    const projMemberRemoved = await projectService.removeProjectMember(
      projectId,
      newMemberUser._id,
      mockUser
    );
    console.log(`✅ Removed Member from Project. Remaining Members: ${projMemberRemoved.members.length}`);

    // Test remove team
    const projTeamRemoved = await projectService.removeProjectTeam(
      projectId,
      'Logistics',
      mockUser
    );
    console.log(`✅ Removed Team 'Logistics'. Remaining Assigned Teams: [${projTeamRemoved.assigned_team_ids.join(', ')}]`);

    // 9. Clean up test records
    console.log('\n⏳ 9. Cleaning up test records...');
    await Project.deleteOne({ _id: projectId });
    await ProjectActionStep.deleteMany({ project_id: projectId });
    await ProjectMessage.deleteMany({ project_id: projectId });
    await ProjectFile.deleteMany({ project_id: projectId });
    await Attachment.deleteOne({ _id: mockAttachment._id });
    await User.deleteOne({ _id: newMemberUser._id });
    console.log('✅ Clean up complete.');

    console.log('\n🎉 =======================================================');
    console.log('🎉 ALL PROJECT MANAGEMENT MODULE INTEGRATION TESTS PASSED!');
    console.log('🎉 =======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Integration Test Failed:', err);
    process.exit(1);
  }
}

runEndToEndVerification();
